import * as path from 'node:path';
import * as vscode from 'vscode';
import {
  formatGitError,
  hasGitRepo,
  readCachedGitWorktrees,
  refreshGitWorktrees
} from '../git/worktreeService';
import { SharedFilesService } from '../shared/sharedFilesService';
import { ProjectRegistry } from '../state/projectRegistry';
import { RegisteredRoot } from '../types';
import { normalizeComparablePath } from '../utils/pathUtils';
import {
  addRootFromDialog,
  ConfigurationKey,
  ConfigurationMap,
  handleRootClick,
  openLocalIgnoreFile,
  openRoot,
  removeRoot
} from '../commands/rootCommands';
import {
  createWorktreeFromDialog,
  openWorktree,
  removeWorktreeFromDialog
} from '../commands/worktreeCommands';
import {
  addSharedFile,
  changeSharedFilesSyncMode,
  removeSharedFile,
  syncSharedFilesNow
} from '../commands/sharedFileCommands';
import { openHelp, openShortcutHelp } from '../commands/helpCommands';
import { revealCurrentRoot, revealCurrentWorktree } from './navigation';
import { getCurrentWorkspacePaths } from './workspaceMatch';
import {
  MessageItem,
  ProjectRootItem,
  SharedFileItem,
  SharedFilesGroupItem,
  TreeNode,
  WorktreeItem
} from './items';

function worktreeSortKey(item: WorktreeItem): number {
  return item.sortRank;
}

export class WorktreeProvider implements vscode.TreeDataProvider<TreeNode> {
  private treeView?: vscode.TreeView<TreeNode>;
  private readonly worktreeCache = new Map<string, TreeNode[]>();
  private readonly worktreeRefreshInFlight = new Map<string, Promise<void>>();
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<
    TreeNode | undefined | void
  >();

  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  constructor(
    private readonly registry: ProjectRegistry,
    private readonly sharedFiles: SharedFilesService,
    private readonly extensionUri: vscode.Uri
  ) {}

  attachTreeView(treeView: vscode.TreeView<TreeNode>): void {
    this.treeView = treeView;
  }

  // ── TreeDataProvider ──────────────────────────────────────────────

  async getChildren(element?: TreeNode): Promise<TreeNode[]> {
    if (!element) {
      const roots = await this.getRegisteredRoots();
      const currentFolders = getCurrentWorkspacePaths();
      return roots.map((entry) => {
        const isGitRepo = hasGitRepo(entry.rootPath);
        const normalizedRoot = normalizeComparablePath(entry.rootPath);
        const isCurrent = currentFolders.some((fp) => {
          const normalizedFp = normalizeComparablePath(fp);
          return (
            normalizedFp === normalizedRoot || normalizedFp.startsWith(normalizedRoot + path.sep)
          );
        });
        return new ProjectRootItem(entry, isGitRepo, isCurrent);
      });
    }

    if (element instanceof ProjectRootItem) {
      return this.getWorktreeItems(element.rootPath);
    }

    if (element instanceof SharedFilesGroupItem) {
      return this.getSharedFileItems(element.rootPath);
    }

    return [];
  }

  getTreeItem(element: TreeNode): vscode.TreeItem {
    return element;
  }

  getParent(element: TreeNode): ProjectRootItem | undefined {
    if (
      element instanceof WorktreeItem ||
      element instanceof SharedFilesGroupItem ||
      element instanceof SharedFileItem
    ) {
      return new ProjectRootItem(
        {
          name: path.basename(element.rootPath) || element.rootPath,
          rootPath: element.rootPath
        },
        true
      );
    }

    return undefined;
  }

  // ── Refresh / Cache ───────────────────────────────────────────────

  refresh(element?: TreeNode): void {
    this.onDidChangeTreeDataEmitter.fire(element);

    const targetRootPath = getRootPathFromTreeNode(element);
    if (targetRootPath) {
      void this.revalidateWorktreeItems(targetRootPath);
      return;
    }

    for (const rootPath of this.worktreeCache.keys()) {
      void this.revalidateWorktreeItems(rootPath);
    }
  }

  softRefresh(): void {
    for (const rootPath of this.worktreeCache.keys()) {
      void this.revalidateWorktreeItems(rootPath);
    }
  }

  getConfig<K extends ConfigurationKey>(key: K): ConfigurationMap[K] | undefined {
    return vscode.workspace.getConfiguration('worktreeNavigator').get<ConfigurationMap[K]>(key);
  }

  // ── Command Delegation (Root) ─────────────────────────────────────

  async addRootFromDialog(): Promise<void> {
    await addRootFromDialog(this.rootCtx());
  }

  async removeRoot(item?: ProjectRootItem): Promise<void> {
    await removeRoot(this.rootCtx(), item);
    if (item?.rootPath) {
      this.worktreeCache.delete(item.rootPath);
      this.worktreeRefreshInFlight.delete(item.rootPath);
    }
  }

  async openRoot(item: ProjectRootItem | undefined, forceNewWindow: boolean): Promise<void> {
    await openRoot(this.rootCtx(), item, forceNewWindow);
  }

  async handleRootClick(item?: ProjectRootItem): Promise<void> {
    await handleRootClick(this.rootCtx(), item);
  }

  async openLocalIgnoreFile(item?: ProjectRootItem): Promise<void> {
    await openLocalIgnoreFile(this.rootCtx(), item);
  }

  // ── Command Delegation (Worktree) ─────────────────────────────────

  async openWorktree(item: WorktreeItem | undefined, forceNewWindow: boolean): Promise<void> {
    await openWorktree(this.worktreeCtx(), item, forceNewWindow);
  }

  async removeWorktreeFromDialog(item?: WorktreeItem): Promise<void> {
    await removeWorktreeFromDialog(this.worktreeCtx(), item);
  }

  async createWorktreeFromDialog(item?: ProjectRootItem): Promise<void> {
    await createWorktreeFromDialog(this.worktreeCtx(), item);
  }

  // ── Command Delegation (Shared Files) ─────────────────────────────

  async addSharedFile(item?: ProjectRootItem | SharedFilesGroupItem): Promise<void> {
    await addSharedFile(this.sharedFileCtx(), item);
  }

  async removeSharedFile(
    item?: ProjectRootItem | SharedFilesGroupItem | SharedFileItem
  ): Promise<void> {
    await removeSharedFile(this.sharedFileCtx(), item);
  }

  async changeSharedFilesSyncMode(item?: ProjectRootItem | SharedFilesGroupItem): Promise<void> {
    await changeSharedFilesSyncMode(this.sharedFileCtx(), item);
  }

  async syncSharedFilesNow(item?: ProjectRootItem | SharedFilesGroupItem): Promise<void> {
    await syncSharedFilesNow(this.sharedFileCtx(), item);
  }

  // ── Command Delegation (Navigation) ───────────────────────────────

  async revealCurrentRoot(): Promise<void> {
    await revealCurrentRoot(this.navigationCtx());
  }

  async revealCurrentWorktree(): Promise<void> {
    await revealCurrentWorktree(this.navigationCtx());
  }

  // ── Command Delegation (Help) ─────────────────────────────────────

  async openShortcutHelp(): Promise<void> {
    await openShortcutHelp();
  }

  async openHelp(): Promise<void> {
    await openHelp(this.extensionUri);
  }

  // ── Internal Data Loading ─────────────────────────────────────────

  async getRegisteredRoots(): Promise<RegisteredRoot[]> {
    return this.registry.list();
  }

  async getRootItems(): Promise<ProjectRootItem[]> {
    const items = await this.getChildren();
    return items.filter((item): item is ProjectRootItem => item instanceof ProjectRootItem);
  }

  async getWorktreeItems(rootPath: string): Promise<TreeNode[]> {
    const cached = this.worktreeCache.get(rootPath);
    if (cached) {
      void this.revalidateWorktreeItems(rootPath);
      return cached;
    }

    const items = await this.loadWorktreeItems(rootPath);
    this.worktreeCache.set(rootPath, items);
    return items;
  }

  async openFolder(folderPath: string, forceNewWindow: boolean): Promise<void> {
    const openInNewWindow = forceNewWindow || Boolean(this.getConfig('openInNewWindow'));

    await vscode.commands.executeCommand(
      'vscode.openFolder',
      vscode.Uri.file(folderPath),
      openInNewWindow
    );
  }

  // ── Private ───────────────────────────────────────────────────────

  private async loadWorktreeItems(rootPath: string, useFresh = false): Promise<TreeNode[]> {
    try {
      const worktrees = useFresh
        ? await refreshGitWorktrees(rootPath)
        : await readCachedGitWorktrees(rootPath);
      if (worktrees.length === 0) {
        return [
          new MessageItem('No worktrees found', 'Git returned no worktree entries.', 'message')
        ];
      }

      const currentFolders = getCurrentWorkspacePaths();
      const worktreeItems = worktrees.map((worktree, index) => {
        const isRegisteredRoot =
          normalizeComparablePath(worktree.path) === normalizeComparablePath(rootPath);
        const isCurrent = currentFolders.some(
          (fp) => normalizeComparablePath(fp) === normalizeComparablePath(worktree.path)
        );

        return new WorktreeItem(
          rootPath,
          worktree,
          {
            isRegisteredRoot,
            isMainWorktree: index === 0
          },
          isCurrent
        );
      });

      worktreeItems.sort((a, b) => worktreeSortKey(a) - worktreeSortKey(b));

      const sharedFilesState = await this.sharedFiles.getViewState(rootPath);
      const groupItem = new SharedFilesGroupItem(
        rootPath,
        sharedFilesState?.sharedFiles ?? [],
        sharedFilesState?.syncMode ?? 'manual',
        sharedFilesState?.mainWorktreePath
      );

      return [groupItem, ...worktreeItems];
    } catch (error) {
      return [new MessageItem('Git worktrees unavailable', formatGitError(error), 'error')];
    }
  }

  private async revalidateWorktreeItems(rootPath: string): Promise<void> {
    const inflight = this.worktreeRefreshInFlight.get(rootPath);
    if (inflight) {
      return inflight;
    }

    const refreshPromise = this.loadWorktreeItems(rootPath, true)
      .then((fresh) => {
        const stale = this.worktreeCache.get(rootPath);
        if (!stale || !treeNodesEqual(stale, fresh)) {
          this.worktreeCache.set(rootPath, fresh);
          this.onDidChangeTreeDataEmitter.fire(undefined);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        this.worktreeRefreshInFlight.delete(rootPath);
      });

    this.worktreeRefreshInFlight.set(rootPath, refreshPromise);
    return refreshPromise;
  }

  private async getSharedFileItems(rootPath: string): Promise<TreeNode[]> {
    const sharedFilesState = await this.sharedFiles.getViewState(rootPath);
    if (!sharedFilesState || sharedFilesState.sharedFiles.length === 0) {
      return [
        new MessageItem(
          'No shared files yet',
          'Add shared files from the main worktree to sync them into other worktrees.',
          'message'
        )
      ];
    }

    return sharedFilesState.sharedFiles.map(
      (relativePath) => new SharedFileItem(rootPath, relativePath)
    );
  }

  // ── Context Factories ─────────────────────────────────────────────

  private rootCtx() {
    return {
      registry: this.registry,
      treeView: this.treeView,
      getConfig: <K extends ConfigurationKey>(key: K) => this.getConfig(key),
      getRegisteredRoots: () => this.getRegisteredRoots(),
      refresh: () => this.refresh(),
      openFolder: (p: string, f: boolean) => this.openFolder(p, f)
    };
  }

  private worktreeCtx() {
    return {
      sharedFiles: this.sharedFiles,
      refresh: () => this.refresh(),
      openFolder: (p: string, f: boolean) => this.openFolder(p, f)
    };
  }

  private sharedFileCtx() {
    return {
      sharedFiles: this.sharedFiles,
      refresh: () => this.refresh()
    };
  }

  private navigationCtx() {
    return {
      treeView: this.treeView,
      getRootItems: () => this.getRootItems(),
      getWorktreeItems: (rootPath: string) => this.getWorktreeItems(rootPath)
    };
  }
}

function getRootPathFromTreeNode(element?: TreeNode): string | undefined {
  if (!element) {
    return undefined;
  }

  return 'rootPath' in element ? element.rootPath : undefined;
}

function treeNodesEqual(a: TreeNode[], b: TreeNode[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  return a.every((node, i) => node.id === b[i].id && node.description === b[i].description);
}
