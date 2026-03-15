import * as fs from 'node:fs/promises';
import type { Dirent } from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { readCachedGitWorktrees } from '../git/worktreeService';
import { ProjectRegistry } from '../state/projectRegistry';
import { RegisteredRoot, SharedFilesSettingsSnapshot, SharedFilesSyncMode } from '../types';
import { normalizeComparablePath } from '../utils/pathUtils';

const EXTENSION_SECTION = 'worktreeNavigator';
const SHARED_FILES_KEY = 'sharedFiles';
const SHARED_FILES_SYNC_MODE_KEY = 'sharedFilesSyncMode';
const DEFAULT_SYNC_MODE: SharedFilesSyncMode = 'manual';
const SETTINGS_PATH_SEGMENTS = ['.vscode', 'settings.json'];

export interface SharedFilesViewState extends SharedFilesSettingsSnapshot {
  rootPath: string;
  isCurrentWorkspaceMain: boolean;
  canEditFromCurrentWorkspace: boolean;
}

interface SharedSyncWarning {
  relativePath: string;
  message: string;
}

interface SharedSyncResult {
  copied: string[];
  warnings: SharedSyncWarning[];
}

type SharedFilesSyncTrigger = 'create' | 'open';

interface MatchedRootContext {
  root: RegisteredRoot;
  worktreePaths: string[];
  mainWorktreePath?: string;
}

export class SharedFilesService {
  constructor(private readonly registry: ProjectRegistry) {}

  async getViewState(rootPath: string): Promise<SharedFilesViewState | undefined> {
    const matched = await this.loadRootContext(rootPath);
    if (!matched?.mainWorktreePath) {
      return undefined;
    }

    const snapshot = await this.readSharedSettingsFromMainWorktree(matched.mainWorktreePath);
    const isCurrentWorkspaceMain = getCurrentWorkspacePaths().some((workspacePath) =>
      areSamePath(workspacePath, matched.mainWorktreePath as string)
    );

    return {
      rootPath,
      sharedFiles: snapshot.sharedFiles,
      syncMode: snapshot.syncMode,
      mainWorktreePath: matched.mainWorktreePath,
      isCurrentWorkspaceMain,
      canEditFromCurrentWorkspace: true
    };
  }

  async addSharedFile(rootPath?: string): Promise<boolean> {
    const editable = await this.resolveEditableRoot(rootPath);
    if (!editable) {
      return false;
    }

    const pickedFiles = await this.pickSharedFiles(
      editable.mainWorktreePath,
      editable.snapshot.sharedFiles
    );
    if (!pickedFiles?.length) {
      return false;
    }

    const nextFiles = [...editable.snapshot.sharedFiles, ...pickedFiles];
    await this.updateSharedSettingsInMainWorktree(editable.mainWorktreePath, {
      sharedFiles: nextFiles
    });
    await this.showGitignoreGuidance(editable.mainWorktreePath, pickedFiles);

    await vscode.window.showInformationMessage(
      `Added ${pickedFiles.length} shared file${pickedFiles.length === 1 ? '' : 's'} in the main worktree settings.`
    );
    return true;
  }

  async removeSharedFile(rootPath?: string, relativePath?: string): Promise<boolean> {
    const editable = await this.resolveEditableRoot(rootPath);
    if (!editable) {
      return false;
    }

    const currentFiles = editable.snapshot.sharedFiles;
    if (currentFiles.length === 0) {
      await vscode.window.showInformationMessage('No shared files are registered for this root.');
      return false;
    }

    const targetPath =
      relativePath ??
      (
        await vscode.window.showQuickPick(
          currentFiles.map((filePath) => ({ label: filePath })),
          { placeHolder: 'Select a shared file to remove' }
        )
      )?.label;

    if (!targetPath) {
      return false;
    }

    const nextFiles = currentFiles.filter((filePath) => filePath !== targetPath);
    await this.updateSharedSettingsInMainWorktree(editable.mainWorktreePath, {
      sharedFiles: nextFiles
    });
    await vscode.window.showInformationMessage(
      `Removed shared file "${targetPath}" from the main worktree settings.`
    );
    return true;
  }

  async changeSyncMode(rootPath?: string): Promise<boolean> {
    const editable = await this.resolveEditableRoot(rootPath);
    if (!editable) {
      return false;
    }

    const picked = await vscode.window.showQuickPick(
      [
        {
          label: 'Manual',
          description: 'Only sync when you run the command explicitly',
          value: 'manual' as const
        },
        {
          label: 'On Create',
          description: 'Sync automatically when a new worktree is created',
          value: 'onCreate' as const
        },
        {
          label: 'On Create + Open',
          description: 'Sync automatically when a new worktree is created and later opened',
          value: 'onCreateAndOpen' as const
        },
        {
          label: 'Off',
          description: 'Disable both automatic and manual sync operations',
          value: 'off' as const
        }
      ],
      {
        placeHolder: `Current mode: ${toSyncModeLabel(editable.snapshot.syncMode)}`
      }
    );

    if (!picked) {
      return false;
    }

    await this.updateSharedSettingsInMainWorktree(editable.mainWorktreePath, {
      syncMode: picked.value
    });
    await vscode.window.showInformationMessage(
      `Shared file sync mode set to "${toSyncModeLabel(picked.value)}" in the main worktree settings.`
    );
    return true;
  }

  async syncNow(rootPath?: string): Promise<boolean> {
    const resolved = await this.resolveRootForCommand(rootPath);
    if (!resolved?.mainWorktreePath) {
      return false;
    }

    const snapshot = await this.readSharedSettingsFromMainWorktree(resolved.mainWorktreePath);
    if (snapshot.syncMode === 'off') {
      await vscode.window.showInformationMessage('Shared file sync is turned off for this root.');
      return false;
    }

    const currentWorkspacePath = getPrimaryWorkspacePath();
    const currentBelongsToRoot =
      currentWorkspacePath &&
      resolved.worktreePaths.some((worktreePath) =>
        areSamePath(worktreePath, currentWorkspacePath)
      );

    let targetPath: string | undefined;
    if (
      currentBelongsToRoot &&
      currentWorkspacePath &&
      !areSamePath(currentWorkspacePath, resolved.mainWorktreePath)
    ) {
      targetPath = currentWorkspacePath;
    } else {
      const candidates = resolved.worktreePaths.filter(
        (worktreePath) => !areSamePath(worktreePath, resolved.mainWorktreePath as string)
      );
      if (candidates.length === 0) {
        await vscode.window.showInformationMessage('No secondary worktrees are available to sync.');
        return false;
      }

      const picked = await vscode.window.showQuickPick(
        candidates.map((worktreePath) => ({
          label: path.basename(worktreePath) || worktreePath,
          description: worktreePath
        })),
        { placeHolder: 'Select a worktree to sync now' }
      );
      targetPath = picked?.description;
    }

    if (!targetPath) {
      return false;
    }

    const result = await this.syncWorktree(rootPath ?? resolved.root.rootPath, targetPath, {
      reason: 'manual',
      respectMode: false
    });
    if (!result) {
      return false;
    }

    await this.showSyncSummary(targetPath, result, false);
    return true;
  }

  async syncCurrentWorkspaceIfNeeded(reason: string): Promise<void> {
    const workspacePath = getPrimaryWorkspacePath();
    if (!workspacePath) {
      return;
    }

    const matched = await this.matchRootForWorkspacePath(workspacePath);
    if (!matched?.mainWorktreePath) {
      return;
    }

    if (areSamePath(workspacePath, matched.mainWorktreePath)) {
      return;
    }

    const result = await this.syncWorktree(matched.root.rootPath, workspacePath, {
      reason,
      trigger: 'open',
      respectMode: true
    });
    if (!result) {
      return;
    }

    await this.showSyncSummary(workspacePath, result, true);
  }

  async syncAddedWorkspaceFolders(folders: readonly vscode.WorkspaceFolder[]): Promise<void> {
    for (const folder of folders) {
      const matched = await this.matchRootForWorkspacePath(folder.uri.fsPath);
      if (!matched?.mainWorktreePath || areSamePath(folder.uri.fsPath, matched.mainWorktreePath)) {
        continue;
      }

      const result = await this.syncWorktree(matched.root.rootPath, folder.uri.fsPath, {
        reason: 'workspace-folder-added',
        trigger: 'open',
        respectMode: true
      });

      if (result) {
        await this.showSyncSummary(folder.uri.fsPath, result, true);
      }
    }
  }

  async syncCreatedWorktree(rootPath: string, worktreePath: string): Promise<boolean> {
    const result = await this.syncWorktree(rootPath, worktreePath, {
      reason: 'create',
      trigger: 'create',
      respectMode: true
    });
    if (!result) {
      return false;
    }

    await this.showSyncSummary(worktreePath, result, true);
    return true;
  }

  async prepareWorktreeForOpen(rootPath: string, worktreePath: string): Promise<void> {
    const result = await this.syncWorktree(rootPath, worktreePath, {
      reason: 'pre-open',
      trigger: 'open',
      respectMode: true
    });
    if (result) {
      await this.showSyncSummary(worktreePath, result, true);
    }
  }

  private async syncWorktree(
    rootPath: string,
    targetWorktreePath: string,
    options: {
      reason: string;
      trigger?: SharedFilesSyncTrigger;
      respectMode: boolean;
    }
  ): Promise<SharedSyncResult | undefined> {
    const matched = await this.loadRootContext(rootPath);
    if (!matched?.mainWorktreePath) {
      return undefined;
    }

    if (areSamePath(targetWorktreePath, matched.mainWorktreePath)) {
      return undefined;
    }

    const snapshot = await this.readSharedSettingsFromMainWorktree(matched.mainWorktreePath);
    if (
      options.respectMode &&
      options.trigger &&
      !shouldSyncForTrigger(snapshot.syncMode, options.trigger)
    ) {
      return undefined;
    }

    if (!snapshot.sharedFiles.length) {
      return undefined;
    }

    const result: SharedSyncResult = {
      copied: [],
      warnings: []
    };

    for (const relativePath of snapshot.sharedFiles) {
      const sourcePath = path.join(matched.mainWorktreePath, relativePath);
      const destinationPath = path.join(targetWorktreePath, relativePath);

      try {
        const sourceStat = await fs.stat(sourcePath);
        if (!sourceStat.isFile()) {
          result.warnings.push({
            relativePath,
            message: 'Source exists but is not a file.'
          });
          continue;
        }

        await fs.mkdir(path.dirname(destinationPath), { recursive: true });
        await fs.copyFile(sourcePath, destinationPath);
        await fs.chmod(destinationPath, sourceStat.mode & 0o777).catch(() => undefined);
        result.copied.push(relativePath);
      } catch (error) {
        result.warnings.push({
          relativePath,
          message: toReadableError(error)
        });
      }
    }

    return result;
  }

  private async showSyncSummary(
    targetWorktreePath: string,
    result: SharedSyncResult,
    notifyOnlyOnWarnings: boolean
  ): Promise<void> {
    if (result.copied.length === 0 && result.warnings.length === 0) {
      return;
    }

    const targetName = path.basename(targetWorktreePath) || targetWorktreePath;
    const summary = [`${result.copied.length} copied`, `${result.warnings.length} warnings`].join(
      ' · '
    );

    if (result.warnings.length > 0) {
      const detail = result.warnings
        .map((warning) => `${warning.relativePath}: ${warning.message}`)
        .join('\n');
      await vscode.window.showWarningMessage(
        `Shared files synced for "${targetName}" (${summary}).`,
        { modal: false, detail }
      );
      return;
    }

    if (!notifyOnlyOnWarnings) {
      await vscode.window.showInformationMessage(
        `Shared files synced for "${targetName}" (${summary}).`
      );
    }
  }

  private async resolveEditableRoot(rootPath?: string): Promise<
    | {
        rootPath: string;
        mainWorktreePath: string;
        snapshot: SharedFilesSettingsSnapshot;
      }
    | undefined
  > {
    const resolved = await this.resolveRootForCommand(rootPath);
    if (!resolved?.mainWorktreePath) {
      return undefined;
    }

    return {
      rootPath: resolved.root.rootPath,
      mainWorktreePath: resolved.mainWorktreePath,
      snapshot: await this.readSharedSettingsFromMainWorktree(resolved.mainWorktreePath)
    };
  }

  private async resolveRootForCommand(rootPath?: string): Promise<MatchedRootContext | undefined> {
    if (rootPath) {
      return this.loadRootContext(rootPath);
    }

    const workspacePath = getPrimaryWorkspacePath();
    if (!workspacePath) {
      await vscode.window.showInformationMessage('Open a worktree workspace first.');
      return undefined;
    }

    return this.matchRootForWorkspacePath(workspacePath);
  }

  private async matchRootForWorkspacePath(
    workspacePath: string
  ): Promise<MatchedRootContext | undefined> {
    const roots = await this.registry.list();
    for (const root of roots) {
      const matched = await this.loadRootContext(root.rootPath);
      if (matched?.worktreePaths.some((worktreePath) => areSamePath(worktreePath, workspacePath))) {
        return matched;
      }
    }
    return undefined;
  }

  private async loadRootContext(rootPath: string): Promise<MatchedRootContext | undefined> {
    try {
      const worktrees = await readCachedGitWorktrees(rootPath);
      const worktreePaths = worktrees.map((worktree) => worktree.path);
      return {
        root: { name: path.basename(rootPath) || rootPath, rootPath },
        worktreePaths,
        mainWorktreePath: worktreePaths[0]
      };
    } catch {
      return undefined;
    }
  }

  private async readSharedSettingsFromMainWorktree(
    mainWorktreePath: string
  ): Promise<SharedFilesSettingsSnapshot> {
    const settingsPath = path.join(mainWorktreePath, ...SETTINGS_PATH_SEGMENTS);
    try {
      const raw = await fs.readFile(settingsPath, 'utf8');
      const parsed = parseJsonc(raw) as Record<string, unknown>;
      return {
        ...normalizeSharedSettings(parsed),
        mainWorktreePath
      };
    } catch {
      return {
        sharedFiles: [],
        syncMode: DEFAULT_SYNC_MODE,
        mainWorktreePath
      };
    }
  }

  private async updateSharedSettingsInMainWorktree(
    mainWorktreePath: string,
    updates: {
      sharedFiles?: string[];
      syncMode?: SharedFilesSyncMode;
    }
  ): Promise<void> {
    const settingsPath = path.join(mainWorktreePath, ...SETTINGS_PATH_SEGMENTS);
    const current = await this.readWritableMainWorktreeSettings(settingsPath);
    const next = { ...current.parsed };

    if (updates.sharedFiles) {
      next[`${EXTENSION_SECTION}.${SHARED_FILES_KEY}`] = updates.sharedFiles;
    }

    if (updates.syncMode) {
      next[`${EXTENSION_SECTION}.${SHARED_FILES_SYNC_MODE_KEY}`] = updates.syncMode;
    }

    await fs.mkdir(path.dirname(settingsPath), { recursive: true });
    await fs.writeFile(settingsPath, `${JSON.stringify(next, null, 2)}${current.eol}`, 'utf8');
  }

  private async readWritableMainWorktreeSettings(settingsPath: string): Promise<{
    parsed: Record<string, unknown>;
    eol: string;
  }> {
    let raw: string;
    try {
      raw = await fs.readFile(settingsPath, 'utf8');
    } catch (error) {
      if (isFileNotFoundError(error)) {
        return {
          parsed: {},
          eol: '\n'
        };
      }
      throw error;
    }

    try {
      const parsed = parseJsonc(raw);
      if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
        throw new Error('The main worktree settings file must contain a JSON object.');
      }

      return {
        parsed: parsed as Record<string, unknown>,
        eol: raw.includes('\r\n') ? '\r\n' : '\n'
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown parse error';
      throw new Error(
        `Could not update ${settingsPath} because it is not valid JSON/JSONC: ${message}`,
        { cause: error }
      );
    }
  }

  private async pickSharedFiles(
    mainWorktreePath: string,
    existingFiles: string[]
  ): Promise<string[] | undefined> {
    const availableFiles = (
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Loading files from the main worktree...'
        },
        () => this.listSelectableFiles(mainWorktreePath)
      )
    ).filter((relativePath) => !existingFiles.includes(relativePath));

    if (availableFiles.length === 0) {
      await vscode.window.showInformationMessage('No additional files are available to share.');
      return undefined;
    }

    const picked = await vscode.window.showQuickPick(
      availableFiles.map((relativePath) => ({ label: relativePath })),
      {
        canPickMany: true,
        matchOnDescription: true,
        placeHolder: 'Select files from the main worktree to share'
      }
    );

    return picked?.map((item) => item.label);
  }

  private async listSelectableFiles(mainWorktreePath: string): Promise<string[]> {
    const collected: string[] = [];
    await this.collectFiles(mainWorktreePath, '', collected);
    return collected.sort((left, right) => left.localeCompare(right));
  }

  private async collectFiles(
    mainWorktreePath: string,
    currentRelativePath: string,
    collected: string[]
  ): Promise<void> {
    const currentPath = currentRelativePath
      ? path.join(mainWorktreePath, currentRelativePath)
      : mainWorktreePath;

    let entries: Dirent[];
    try {
      entries = await fs.readdir(currentPath, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const relativePath = normalizeRelativeSharedFilePath(
        currentRelativePath ? path.join(currentRelativePath, entry.name) : entry.name
      );

      if (entry.isDirectory()) {
        if (shouldSkipSharedFilesPickerDirectory(entry.name)) {
          continue;
        }

        await this.collectFiles(mainWorktreePath, relativePath, collected);
        continue;
      }

      if (entry.isFile() || entry.isSymbolicLink()) {
        collected.push(relativePath);
      }
    }
  }

  private async showGitignoreGuidance(
    mainWorktreePath: string,
    relativePaths: string[]
  ): Promise<void> {
    const gitignorePath = path.join(mainWorktreePath, '.gitignore');
    const missingEntries = new Set(relativePaths);

    try {
      const contents = await fs.readFile(gitignorePath, 'utf8');
      const lines = contents
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

      for (const relativePath of relativePaths) {
        if (
          lines.includes(relativePath) ||
          lines.includes(`/${relativePath}`) ||
          lines.includes(path.basename(relativePath))
        ) {
          missingEntries.delete(relativePath);
        }
      }
    } catch {
      // ignore missing .gitignore; guidance below is still useful
    }

    if (missingEntries.size === 0) {
      return;
    }

    await vscode.window.showInformationMessage(
      `Consider adding these to .gitignore if they should stay local to each worktree: ${Array.from(missingEntries).join(', ')}`
    );
  }
}

function normalizeSharedSettings(parsed: Record<string, unknown>): SharedFilesSettingsSnapshot {
  const sharedFiles = Array.isArray(parsed[`${EXTENSION_SECTION}.${SHARED_FILES_KEY}`])
    ? (parsed[`${EXTENSION_SECTION}.${SHARED_FILES_KEY}`] as unknown[])
        .filter((entry): entry is string => typeof entry === 'string')
        .filter((entry) => !validateRelativeSharedFilePath(entry))
        .map((entry) => normalizeRelativeSharedFilePath(entry))
        .filter((entry, index, values) => Boolean(entry) && values.indexOf(entry) === index)
    : [];

  const syncMode = normalizeSharedFilesSyncMode(
    parsed[`${EXTENSION_SECTION}.${SHARED_FILES_SYNC_MODE_KEY}`]
  );

  return {
    sharedFiles,
    syncMode
  };
}

function parseJsonc(raw: string): unknown {
  let output = '';
  let index = 0;
  let inString = false;
  let stringDelimiter = '"';

  while (index < raw.length) {
    const current = raw[index];
    const next = raw[index + 1];

    if (inString) {
      output += current;
      if (current === '\\') {
        output += next ?? '';
        index += 2;
        continue;
      }

      if (current === stringDelimiter) {
        inString = false;
      }

      index += 1;
      continue;
    }

    if (current === '"') {
      inString = true;
      stringDelimiter = current;
      output += current;
      index += 1;
      continue;
    }

    if (current === '/' && next === '/') {
      index += 2;
      while (index < raw.length && raw[index] !== '\n') {
        index += 1;
      }
      continue;
    }

    if (current === '/' && next === '*') {
      index += 2;
      while (index < raw.length && !(raw[index] === '*' && raw[index + 1] === '/')) {
        index += 1;
      }
      index += 2;
      continue;
    }

    output += current;
    index += 1;
  }

  const normalized = stripTrailingCommas(output).trim();
  if (!normalized) {
    return {};
  }

  return JSON.parse(normalized);
}

function stripTrailingCommas(input: string): string {
  return input.replace(/,\s*([}\]])/g, '$1');
}

function validateRelativeSharedFilePath(value: string): string | undefined {
  const normalized = normalizeRelativeSharedFilePath(value);
  if (!normalized) {
    return 'Path is required.';
  }

  if (path.isAbsolute(value.trim())) {
    return 'Only paths relative to the main worktree are supported.';
  }

  if (normalized.startsWith('..')) {
    return 'Shared file paths cannot escape the main worktree.';
  }

  return undefined;
}

function normalizeRelativeSharedFilePath(value: string): string {
  const normalized = path
    .normalize(value.trim().replace(/\\/g, '/'))
    .replace(/^[.][/\\]/, '')
    .replace(/^[/\\]+/, '');

  return normalized === '.' ? '' : normalized;
}

function isSharedFilesSyncMode(value: unknown): value is SharedFilesSyncMode {
  return (
    value === 'manual' || value === 'onCreate' || value === 'onCreateAndOpen' || value === 'off'
  );
}

function shouldSyncForTrigger(
  syncMode: SharedFilesSyncMode,
  trigger: SharedFilesSyncTrigger
): boolean {
  switch (syncMode) {
    case 'onCreate':
      return trigger === 'create';
    case 'onCreateAndOpen':
      return true;
    default:
      return false;
  }
}

function normalizeSharedFilesSyncMode(value: unknown): SharedFilesSyncMode {
  if (value === 'auto' || value === 'onOpen') {
    return 'onCreateAndOpen';
  }

  return isSharedFilesSyncMode(value) ? value : DEFAULT_SYNC_MODE;
}

function toSyncModeLabel(syncMode: SharedFilesSyncMode): string {
  switch (syncMode) {
    case 'manual':
      return 'Manual';
    case 'onCreate':
      return 'On Create';
    case 'onCreateAndOpen':
      return 'On Create + Open';
    case 'off':
      return 'Off';
  }
}

function getCurrentWorkspacePaths(): string[] {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders) {
    return [];
  }

  return folders.map((folder) => folder.uri.fsPath);
}

function getPrimaryWorkspacePath(): string | undefined {
  return getCurrentWorkspacePaths()[0];
}

function areSamePath(left: string, right: string): boolean {
  return normalizeComparablePath(left) === normalizeComparablePath(right);
}

function toReadableError(error: unknown): string {
  if (isFileNotFoundError(error)) {
    return 'Source file was not found in the main worktree.';
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Unknown error';
}

function isFileNotFoundError(error: unknown): error is NodeJS.ErrnoException {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT');
}

function shouldSkipSharedFilesPickerDirectory(name: string): boolean {
  return name === '.git' || name === 'node_modules';
}
