import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as vscode from 'vscode';
import {
  formatGitError,
  getGitInfoExcludePath,
  readCachedGitWorktrees
} from '../git/worktreeService';
import { ProjectRegistry } from '../state/projectRegistry';
import { RegisteredRoot } from '../types';
import { normalizeComparablePath, normalizeFsPath } from '../utils/pathUtils';
import { ProjectRootItem, TreeNode } from '../view/items';
import { getPreferredWorkspacePaths } from '../view/workspaceMatch';

export type ConfigurationKey =
  | 'openInNewWindow'
  | 'doubleClickIntervalMs'
  | 'autoRefreshOnWindowFocus'
  | 'enableRootDoubleClick';

export interface ConfigurationMap {
  openInNewWindow: boolean;
  doubleClickIntervalMs: number;
  autoRefreshOnWindowFocus: boolean;
  enableRootDoubleClick: boolean;
}

export interface RootCommandContext {
  registry: ProjectRegistry;
  treeView: vscode.TreeView<TreeNode> | undefined;
  getConfig<K extends ConfigurationKey>(key: K): ConfigurationMap[K] | undefined;
  getRegisteredRoots(): Promise<RegisteredRoot[]>;
  refresh(): void;
  openFolder(folderPath: string, forceNewWindow: boolean): Promise<void>;
}

const rootClickState = new Map<string, number>();

export async function addRootFromDialog(ctx: RootCommandContext): Promise<void> {
  const selected = await vscode.window.showOpenDialog({
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: false,
    openLabel: 'Register Project Root'
  });

  if (!selected?.length) {
    return;
  }

  const normalized = await normalizeFsPath(selected[0].fsPath);
  const roots = await ctx.getRegisteredRoots();
  if (roots.some((entry) => entry.rootPath === normalized)) {
    await vscode.window.showInformationMessage('That project root is already registered.');
    return;
  }

  await ctx.registry.add({
    name: path.basename(normalized) || normalized,
    rootPath: normalized
  });

  ctx.refresh();
}

export async function removeRoot(
  ctx: RootCommandContext,
  item?: ProjectRootItem
): Promise<void> {
  const rootPath = item?.rootPath;
  if (!rootPath) {
    return;
  }

  await ctx.registry.remove(rootPath);
  rootClickState.delete(rootPath);
  ctx.refresh();
}

export async function openRoot(
  ctx: RootCommandContext,
  item: ProjectRootItem | undefined,
  forceNewWindow: boolean
): Promise<void> {
  const rootPath = item?.rootPath;
  if (!rootPath) {
    return;
  }

  await ctx.openFolder(rootPath, forceNewWindow);
}

export async function handleRootClick(
  ctx: RootCommandContext,
  item?: ProjectRootItem
): Promise<void> {
  const rootPath = item?.rootPath;
  if (!rootPath || !ctx.treeView || !item) {
    return;
  }

  const now = Date.now();
  const interval = Number(ctx.getConfig('doubleClickIntervalMs')) || 400;
  const enableRootDoubleClick = Boolean(ctx.getConfig('enableRootDoubleClick'));
  const lastClickAt = rootClickState.get(rootPath) || 0;
  rootClickState.set(rootPath, now);

  if (enableRootDoubleClick && now - lastClickAt <= interval) {
    rootClickState.delete(rootPath);
    await ctx.openFolder(rootPath, false);
    return;
  }

  await ctx.treeView.reveal(item, {
    expand: true,
    focus: false,
    select: true
  });
}

export async function openLocalIgnoreFile(
  ctx: RootCommandContext,
  item?: ProjectRootItem
): Promise<void> {
  const rootPath = await resolveRootPathForCommand(ctx, item?.rootPath);
  if (!rootPath) {
    return;
  }

  try {
    const excludePath = await getGitInfoExcludePath(rootPath);
    await fs.mkdir(path.dirname(excludePath), { recursive: true });
    try {
      await fs.access(excludePath);
    } catch {
      await fs.writeFile(excludePath, '', 'utf8');
    }

    const document = await vscode.workspace.openTextDocument(excludePath);
    await vscode.window.showTextDocument(document, { preview: false });
  } catch (error) {
    await vscode.window.showErrorMessage(
      `Failed to open .git/info/exclude: ${formatGitError(error)}`
    );
  }
}

export function clearRootClickState(rootPath: string): void {
  rootClickState.delete(rootPath);
}

async function resolveRootPathForCommand(
  ctx: RootCommandContext,
  rootPath?: string
): Promise<string | undefined> {
  if (rootPath) {
    return rootPath;
  }

  const workspacePath = getPreferredWorkspacePaths()[0];
  if (!workspacePath) {
    await vscode.window.showInformationMessage('Open a registered root or worktree first.');
    return undefined;
  }

  const roots = await ctx.getRegisteredRoots();
  for (const root of roots) {
    try {
      const worktrees = await readCachedGitWorktrees(root.rootPath);
      if (
        worktrees.some(
          (worktree) =>
            normalizeComparablePath(worktree.path) === normalizeComparablePath(workspacePath)
        )
      ) {
        return root.rootPath;
      }
    } catch {
      // ignore invalid roots while resolving the current workspace
    }
  }

  await vscode.window.showInformationMessage(
    'The current workspace does not match any registered root.'
  );
  return undefined;
}
