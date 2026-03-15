import * as os from 'node:os';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { GitWorktreeRecord, RegisteredRoot, SharedFilesSyncMode, WorktreeFlags } from '../types';

export class ProjectRootItem extends vscode.TreeItem {
  readonly rootPath: string;
  readonly isGitRepo: boolean;

  constructor(entry: RegisteredRoot, isGitRepo: boolean, isCurrent: boolean = false) {
    super(
      entry.name,
      isGitRepo ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None
    );
    this.rootPath = entry.rootPath;
    this.isGitRepo = isGitRepo;
    this.id = `root:${entry.rootPath}`;
    this.contextValue = isGitRepo ? 'root' : 'directory';
    this.resourceUri = vscode.Uri.file(entry.rootPath);
    this.description = isCurrent
      ? `${shortenPath(entry.rootPath)}  ★ current`
      : shortenPath(entry.rootPath);
    this.tooltip = buildRootTooltip(entry, isGitRepo, isCurrent);
    this.iconPath = getProjectRootIconPath();
    this.command = {
      command: isGitRepo ? 'worktreeNavigator.handleRootClick' : 'worktreeNavigator.openRoot',
      title: isGitRepo ? 'Expand or Open Project Root' : 'Open Directory',
      arguments: [this]
    };
  }
}

export class WorktreeItem extends vscode.TreeItem {
  readonly rootPath: string;
  readonly worktreePath: string;
  readonly branch?: string;
  readonly sortRank: number;

  constructor(
    rootPath: string,
    worktree: GitWorktreeRecord,
    flags: WorktreeFlags,
    isCurrent: boolean = false
  ) {
    const label = path.basename(worktree.path) || worktree.path;
    super(label, vscode.TreeItemCollapsibleState.None);
    this.rootPath = rootPath;
    this.worktreePath = worktree.path;
    this.branch = worktree.branch;
    this.sortRank = getWorktreeSortRank(worktree, flags);
    this.id = `worktree:${rootPath}:${worktree.path}`;
    this.contextValue = 'worktree';
    this.resourceUri = vscode.Uri.file(worktree.path);
    this.iconPath = isCurrent
      ? new vscode.ThemeIcon('check', new vscode.ThemeColor('charts.green'))
      : pickWorktreeIcon(worktree, flags);
    this.description = isCurrent
      ? `${describeWorktree(worktree, flags)}  ★ current`
      : describeWorktree(worktree, flags);
    this.tooltip = buildWorktreeTooltip(worktree, flags, isCurrent);
    this.command = {
      command: 'worktreeNavigator.openWorktree',
      title: 'Open Worktree',
      arguments: [this]
    };
  }
}

export class SharedFilesGroupItem extends vscode.TreeItem {
  readonly rootPath: string;
  readonly mainWorktreePath?: string;

  constructor(
    rootPath: string,
    sharedFiles: string[],
    syncMode: SharedFilesSyncMode,
    mainWorktreePath?: string
  ) {
    super(
      'Shared Files',
      sharedFiles.length > 0
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.Expanded
    );
    this.rootPath = rootPath;
    this.mainWorktreePath = mainWorktreePath;
    this.id = `shared-files:${rootPath}`;
    this.contextValue = 'sharedFilesGroup';
    this.iconPath = new vscode.ThemeIcon('files', new vscode.ThemeColor('charts.blue'));
    this.description = `${formatSharedFilesSyncMode(syncMode)} · ${sharedFiles.length} item${sharedFiles.length === 1 ? '' : 's'}`;
    this.tooltip = buildSharedFilesTooltip(sharedFiles, syncMode, mainWorktreePath);
  }
}

export class SharedFileItem extends vscode.TreeItem {
  readonly rootPath: string;
  readonly relativePath: string;

  constructor(rootPath: string, relativePath: string) {
    super(relativePath, vscode.TreeItemCollapsibleState.None);
    this.rootPath = rootPath;
    this.relativePath = relativePath;
    this.id = `shared-file:${rootPath}:${relativePath}`;
    this.contextValue = 'sharedFile';
    this.iconPath = new vscode.ThemeIcon(
      'file-code',
      new vscode.ThemeColor('list.deemphasizedForeground')
    );
    this.description = 'sync from main worktree';
    this.tooltip = `Shared file copied from the main worktree: ${relativePath}`;
  }
}

export class MessageItem extends vscode.TreeItem {
  constructor(label: string, description: string, kind: 'message' | 'error') {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.id = `${kind}:${label}:${description}`;
    this.contextValue = kind;
    this.description = description;
    this.tooltip = description;
    this.iconPath = new vscode.ThemeIcon(
      kind === 'error' ? 'warning' : 'info',
      kind === 'error'
        ? new vscode.ThemeColor('list.warningForeground')
        : new vscode.ThemeColor('list.deemphasizedForeground')
    );
  }
}

export type TreeNode =
  | ProjectRootItem
  | WorktreeItem
  | SharedFilesGroupItem
  | SharedFileItem
  | MessageItem;

function getProjectRootIconPath(): vscode.Uri {
  return vscode.Uri.file(path.resolve(__dirname, '../../media/directory.svg'));
}

function shortenPath(fullPath: string): string {
  const home = os.homedir();
  if (fullPath.startsWith(home)) {
    return '~' + fullPath.slice(home.length);
  }
  return fullPath;
}

function pickWorktreeIcon(worktree: GitWorktreeRecord, flags: WorktreeFlags): vscode.ThemeIcon {
  if (worktree.locked) {
    return new vscode.ThemeIcon('lock', new vscode.ThemeColor('list.warningForeground'));
  }
  if (worktree.prunable) {
    return new vscode.ThemeIcon('trash', new vscode.ThemeColor('list.deemphasizedForeground'));
  }
  if (worktree.bare) {
    return new vscode.ThemeIcon('archive', new vscode.ThemeColor('list.deemphasizedForeground'));
  }
  if (worktree.detached) {
    return new vscode.ThemeIcon('git-commit', new vscode.ThemeColor('charts.orange'));
  }
  if (flags.isRegisteredRoot) {
    return new vscode.ThemeIcon('home', new vscode.ThemeColor('charts.green'));
  }
  if (flags.isMainWorktree) {
    return new vscode.ThemeIcon('star-full', new vscode.ThemeColor('charts.yellow'));
  }
  return new vscode.ThemeIcon('git-branch', new vscode.ThemeColor('charts.purple'));
}

function describeWorktree(worktree: GitWorktreeRecord, flags: WorktreeFlags): string {
  const parts: string[] = [];

  if (worktree.branch) {
    parts.push(worktree.branch);
  } else if (worktree.detached) {
    parts.push(`detached @ ${worktree.head?.slice(0, 7) ?? '???'}`);
  }

  const tags: string[] = [];
  if (flags.isRegisteredRoot) {
    tags.push('root');
  } else if (flags.isMainWorktree) {
    tags.push('main');
  }
  if (worktree.locked) {
    tags.push('locked');
  }
  if (worktree.prunable) {
    tags.push('prunable');
  }

  if (tags.length > 0) {
    parts.push(tags.join(' · '));
  }

  return parts.join('  ');
}

function buildRootTooltip(
  entry: RegisteredRoot,
  isGitRepo: boolean,
  isCurrent: boolean = false
): vscode.MarkdownString {
  const md = new vscode.MarkdownString('', true);
  md.supportThemeIcons = true;
  const icon = isGitRepo ? '$(repo)' : '$(folder)';
  md.appendMarkdown(`${icon} **${entry.name}**\n\n`);
  if (isCurrent) {
    md.appendMarkdown(`$(check) **Currently open workspace**\n\n`);
  }
  md.appendMarkdown(`---\n\n`);
  md.appendMarkdown(`$(folder) \`${entry.rootPath}\`\n\n`);
  if (isGitRepo) {
    md.appendMarkdown(`_Double-click to open · Right-click for more options_`);
  } else {
    md.appendMarkdown(`_Click to open · Right-click for more options_`);
  }
  return md;
}

function buildWorktreeTooltip(
  worktree: GitWorktreeRecord,
  flags: WorktreeFlags,
  isCurrent: boolean = false
): vscode.MarkdownString {
  const md = new vscode.MarkdownString('', true);
  md.supportThemeIcons = true;

  const name = path.basename(worktree.path) || worktree.path;
  md.appendMarkdown(`$(git-branch) **${name}**\n\n`);
  if (isCurrent) {
    md.appendMarkdown(`$(check) **Currently open workspace**\n\n`);
  }
  md.appendMarkdown(`---\n\n`);

  md.appendMarkdown(`$(folder) \`${shortenPath(worktree.path)}\`\n\n`);

  if (flags.isRegisteredRoot) {
    md.appendMarkdown(`$(home) Registered project root\n\n`);
  } else if (flags.isMainWorktree) {
    md.appendMarkdown(`$(star-full) Main worktree\n\n`);
  }

  if (worktree.branch) {
    md.appendMarkdown(`$(source-control) Branch: \`${worktree.branch}\`\n\n`);
  }

  if (worktree.detached) {
    md.appendMarkdown(`$(git-commit) Detached HEAD\n\n`);
  }

  if (worktree.head) {
    md.appendMarkdown(`$(git-commit) \`${worktree.head.slice(0, 12)}\`\n\n`);
  }

  if (worktree.locked) {
    const reason = typeof worktree.locked === 'string' ? `: ${worktree.locked}` : '';
    md.appendMarkdown(`$(lock) Locked${reason}\n\n`);
  }

  if (worktree.prunable) {
    const reason = typeof worktree.prunable === 'string' ? `: ${worktree.prunable}` : '';
    md.appendMarkdown(`$(trash) Prunable${reason}\n\n`);
  }

  return md;
}

function buildSharedFilesTooltip(
  sharedFiles: string[],
  syncMode: SharedFilesSyncMode,
  mainWorktreePath?: string
): vscode.MarkdownString {
  const md = new vscode.MarkdownString('', true);
  md.supportThemeIcons = true;
  md.appendMarkdown(`$(files) **Shared Files**\n\n`);
  md.appendMarkdown(`$(sync) Mode: \`${formatSharedFilesSyncMode(syncMode)}\`\n\n`);

  if (mainWorktreePath) {
    md.appendMarkdown(`$(star-full) Main worktree: \`${shortenPath(mainWorktreePath)}\`\n\n`);
  }

  md.appendMarkdown('---\n\n');
  if (sharedFiles.length === 0) {
    md.appendMarkdown('_No shared files configured yet._');
    return md;
  }

  md.appendMarkdown(sharedFiles.map((sharedFile) => `- \`${sharedFile}\``).join('\n'));
  return md;
}

function formatSharedFilesSyncMode(syncMode: SharedFilesSyncMode): string {
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

function getWorktreeSortRank(worktree: GitWorktreeRecord, flags: WorktreeFlags): number {
  if (flags.isMainWorktree) {
    return 0;
  }

  if (flags.isRegisteredRoot) {
    return 1;
  }

  if (worktree.locked) {
    return 4;
  }

  if (worktree.prunable) {
    return 5;
  }

  if (worktree.detached || worktree.bare) {
    return 3;
  }

  return 2;
}
