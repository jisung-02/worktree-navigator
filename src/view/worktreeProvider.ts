import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as vscode from 'vscode';
import {
  createWorktree,
  deleteBranch,
  findGitRoot,
  formatGitError,
  getGitInfoExcludePath,
  hasGitRepo,
  listBranches,
  readCachedGitWorktrees,
  refreshGitWorktrees,
  readGitWorktrees,
  removeWorktree
} from '../git/worktreeService';
import { SharedFilesService } from '../shared/sharedFilesService';
import { ProjectRegistry } from '../state/projectRegistry';
import { RegisteredRoot } from '../types';
import { normalizeComparablePath, normalizeFsPath } from '../utils/pathUtils';
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

type ConfigurationKey =
  | 'openInNewWindow'
  | 'doubleClickIntervalMs'
  | 'autoRefreshOnWindowFocus'
  | 'enableRootDoubleClick';

interface ConfigurationMap {
  openInNewWindow: boolean;
  doubleClickIntervalMs: number;
  autoRefreshOnWindowFocus: boolean;
  enableRootDoubleClick: boolean;
}

export class WorktreeProvider implements vscode.TreeDataProvider<TreeNode> {
  private treeView?: vscode.TreeView<TreeNode>;
  private readonly rootClickState = new Map<string, number>();
  private readonly worktreeCache = new Map<string, TreeNode[]>();
  private readonly worktreeRefreshInFlight = new Map<string, Promise<void>>();
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<
    TreeNode | undefined | void
  >();

  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  constructor(
    private readonly registry: ProjectRegistry,
    private readonly sharedFiles: SharedFilesService
  ) {}

  attachTreeView(treeView: vscode.TreeView<TreeNode>): void {
    this.treeView = treeView;
  }

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

  /**
   * Stale-while-revalidate: 캐시된 데이터를 즉시 보여주고 백그라운드에서 갱신.
   */
  softRefresh(): void {
    for (const rootPath of this.worktreeCache.keys()) {
      void this.revalidateWorktreeItems(rootPath);
    }
  }

  async getChildren(element?: TreeNode): Promise<TreeNode[]> {
    if (!element) {
      const roots = await this.getRegisteredRoots();
      const currentFolders = getCurrentWorkspacePaths();
      return roots.map((entry) => {
        const isGitRepo = hasGitRepo(entry.rootPath);
        const normalizedRoot = normalizeComparablePath(entry.rootPath);
        const isCurrent = currentFolders.some((fp) => {
          const normalizedFp = normalizeComparablePath(fp);
          // 정확히 일치하거나, 워크스페이스가 이 root의 하위 디렉터리인 경우
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

  async removeRoot(item?: ProjectRootItem): Promise<void> {
    const rootPath = item?.rootPath;
    if (!rootPath) {
      return;
    }

    await this.registry.remove(rootPath);
    this.rootClickState.delete(rootPath);
    this.worktreeCache.delete(rootPath);
    this.worktreeRefreshInFlight.delete(rootPath);
    this.refresh();
  }

  async openRoot(item: ProjectRootItem | undefined, forceNewWindow: boolean): Promise<void> {
    const rootPath = item?.rootPath;
    if (!rootPath) {
      return;
    }

    await this.openFolder(rootPath, forceNewWindow);
  }

  async openWorktree(item: WorktreeItem | undefined, forceNewWindow: boolean): Promise<void> {
    const worktreePath = item?.worktreePath;
    if (!worktreePath) {
      return;
    }

    await this.sharedFiles.prepareWorktreeForOpen(item.rootPath, worktreePath);
    await this.openFolder(worktreePath, forceNewWindow);
  }

  async handleRootClick(item?: ProjectRootItem): Promise<void> {
    const rootPath = item?.rootPath;
    if (!rootPath || !this.treeView || !item) {
      return;
    }

    const now = Date.now();
    const interval = Number(this.getConfig('doubleClickIntervalMs')) || 400;
    const enableRootDoubleClick = Boolean(this.getConfig('enableRootDoubleClick'));
    const lastClickAt = this.rootClickState.get(rootPath) || 0;
    this.rootClickState.set(rootPath, now);

    if (enableRootDoubleClick && now - lastClickAt <= interval) {
      this.rootClickState.delete(rootPath);
      await this.openFolder(rootPath, false);
      return;
    }

    await this.treeView.reveal(item, {
      expand: true,
      focus: false,
      select: true
    });
  }

  async addRootFromDialog(): Promise<void> {
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
    const roots = await this.getRegisteredRoots();
    if (roots.some((entry) => entry.rootPath === normalized)) {
      await vscode.window.showInformationMessage('That project root is already registered.');
      return;
    }

    await this.registry.add({
      name: path.basename(normalized) || normalized,
      rootPath: normalized
    });

    this.refresh();
  }

  async addSharedFile(item?: ProjectRootItem | SharedFilesGroupItem): Promise<void> {
    if (await this.sharedFiles.addSharedFile(item?.rootPath)) {
      this.refresh();
    }
  }

  async removeSharedFile(
    item?: ProjectRootItem | SharedFilesGroupItem | SharedFileItem
  ): Promise<void> {
    const rootPath = item?.rootPath;
    const relativePath = item instanceof SharedFileItem ? item.relativePath : undefined;
    if (await this.sharedFiles.removeSharedFile(rootPath, relativePath)) {
      this.refresh();
    }
  }

  async changeSharedFilesSyncMode(item?: ProjectRootItem | SharedFilesGroupItem): Promise<void> {
    if (await this.sharedFiles.changeSyncMode(item?.rootPath)) {
      this.refresh();
    }
  }

  async syncSharedFilesNow(item?: ProjectRootItem | SharedFilesGroupItem): Promise<void> {
    if (await this.sharedFiles.syncNow(item?.rootPath)) {
      this.refresh();
    }
  }

  async openLocalIgnoreFile(item?: ProjectRootItem): Promise<void> {
    const rootPath = await this.resolveRootPathForCommand(item?.rootPath);
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

  async removeWorktreeFromDialog(item?: WorktreeItem): Promise<void> {
    const worktreePath = item?.worktreePath;
    if (!worktreePath) {
      return;
    }

    const name = path.basename(worktreePath);
    const confirm = await vscode.window.showWarningMessage(
      `Remove worktree "${name}"?`,
      { modal: true, detail: `Path: ${worktreePath}` },
      'Remove',
      'Force Remove'
    );
    if (!confirm) {
      return;
    }

    const isForce = confirm === 'Force Remove';
    try {
      await removeWorktree(item.rootPath, worktreePath, isForce);
      this.refresh();

      if (item.branch) {
        const deleteBranchAction = await vscode.window.showWarningMessage(
          `Delete local branch "${item.branch}"?`,
          { modal: true, detail: `Worktree "${name}" has been removed.` },
          'Delete Branch',
          'Force Delete Branch'
        );
        if (
          deleteBranchAction === 'Delete Branch' ||
          deleteBranchAction === 'Force Delete Branch'
        ) {
          try {
            await deleteBranch(
              item.rootPath,
              item.branch,
              deleteBranchAction === 'Force Delete Branch'
            );
            await vscode.window.showInformationMessage(`Branch "${item.branch}" deleted.`);
          } catch (branchError) {
            await vscode.window.showErrorMessage(
              `Failed to delete branch: ${formatGitError(branchError)}`
            );
          }
        }
      } else {
        await vscode.window.showInformationMessage(`Worktree "${name}" removed.`);
      }
    } catch (error) {
      await vscode.window.showErrorMessage(`Failed to remove worktree: ${formatGitError(error)}`);
    }
  }

  async createWorktreeFromDialog(item?: ProjectRootItem): Promise<void> {
    const rootPath = item?.rootPath;
    if (!rootPath) {
      return;
    }

    const mode = await vscode.window.showQuickPick(
      [
        {
          label: '$(add) New Branch',
          description: 'Create a new branch',
          value: 'new' as const
        },
        {
          label: '$(git-branch) Existing Branch',
          description: 'Checkout an existing branch',
          value: 'existing' as const
        }
      ],
      { placeHolder: 'Create worktree from...' }
    );
    if (!mode) {
      return;
    }

    let branch: string;
    let createNewBranch: boolean;
    let baseBranch: string | undefined;

    if (mode.value === 'existing') {
      const { local, remote } = await listBranches(rootPath);
      const existingWorktrees = await readGitWorktrees(rootPath);
      const usedBranches = new Set(existingWorktrees.map((wt) => wt.branch).filter(Boolean));

      const items: vscode.QuickPickItem[] = [];
      for (const b of local) {
        if (!usedBranches.has(b)) {
          items.push({ label: b, description: 'local' });
        }
      }
      for (const b of remote) {
        const short = b.replace(/^[^/]+\//, '');
        if (!usedBranches.has(short) && !local.includes(short)) {
          items.push({ label: b, description: 'remote' });
        }
      }

      if (items.length === 0) {
        await vscode.window.showInformationMessage(
          'No available branches. All branches already have worktrees.'
        );
        return;
      }

      const picked = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select a branch'
      });
      if (!picked) {
        return;
      }

      branch = picked.label;
      createNewBranch = false;
    } else {
      const branchName = await vscode.window.showInputBox({
        prompt: 'New branch name',
        placeHolder: 'feature/my-branch',
        validateInput: (value) => {
          if (!value.trim()) {
            return 'Branch name is required';
          }
          if (/\s/.test(value)) {
            return 'Branch name cannot contain spaces';
          }
          return undefined;
        }
      });
      if (!branchName) {
        return;
      }

      const { local } = await listBranches(rootPath);
      const sorted = [...local].sort((a, b) => {
        const aMain = a === 'main' || a === 'master' ? 0 : 1;
        const bMain = b === 'main' || b === 'master' ? 0 : 1;
        return aMain - bMain;
      });
      const baseItems: vscode.QuickPickItem[] = sorted.map((b) => ({
        label: b
      }));
      const basePicked = await vscode.window.showQuickPick(baseItems, {
        placeHolder: 'Select base branch (ESC to use HEAD)'
      });

      branch = branchName;
      createNewBranch = true;
      baseBranch = basePicked?.label;
    }

    const gitRoot = await findGitRoot(rootPath);
    const defaultPath = path.join(
      path.dirname(gitRoot),
      branch.replace(/^[^/]+\//, '').replace(/\//g, '-')
    );
    const worktreePath = await vscode.window.showInputBox({
      prompt: 'Worktree directory path',
      value: defaultPath,
      validateInput: (value) => {
        if (!value.trim()) {
          return 'Path is required';
        }
        return undefined;
      }
    });
    if (!worktreePath) {
      return;
    }

    try {
      await createWorktree({
        repoPath: rootPath,
        worktreePath,
        branch,
        createNewBranch,
        baseBranch
      });
      this.refresh();
      const syncedOnCreate = await this.sharedFiles.syncCreatedWorktree(rootPath, worktreePath);
      const action = await vscode.window.showInformationMessage(
        `Worktree created: ${path.basename(worktreePath)}`,
        'Open',
        'Open in New Window'
      );
      if (action === 'Open') {
        if (!syncedOnCreate) {
          await this.sharedFiles.prepareWorktreeForOpen(rootPath, worktreePath);
        }
        await this.openFolder(worktreePath, false);
      } else if (action === 'Open in New Window') {
        if (!syncedOnCreate) {
          await this.sharedFiles.prepareWorktreeForOpen(rootPath, worktreePath);
        }
        await this.openFolder(worktreePath, true);
      }
    } catch (error) {
      await vscode.window.showErrorMessage(`Failed to create worktree: ${formatGitError(error)}`);
    }
  }

  getConfig<K extends ConfigurationKey>(key: K): ConfigurationMap[K] | undefined {
    return vscode.workspace.getConfiguration('worktreeNavigator').get<ConfigurationMap[K]>(key);
  }

  private async getRegisteredRoots(): Promise<RegisteredRoot[]> {
    return this.registry.list();
  }

  private async resolveRootPathForCommand(rootPath?: string): Promise<string | undefined> {
    if (rootPath) {
      return rootPath;
    }

    const workspacePath = getCurrentWorkspacePaths()[0];
    if (!workspacePath) {
      await vscode.window.showInformationMessage('Open a registered root or worktree first.');
      return undefined;
    }

    const roots = await this.getRegisteredRoots();
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

  private async getWorktreeItems(rootPath: string): Promise<TreeNode[]> {
    const cached = this.worktreeCache.get(rootPath);
    if (cached) {
      void this.revalidateWorktreeItems(rootPath);
      return cached;
    }

    const items = await this.loadWorktreeItems(rootPath);
    this.worktreeCache.set(rootPath, items);
    return items;
  }

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

  private async openFolder(folderPath: string, forceNewWindow: boolean): Promise<void> {
    const openInNewWindow = forceNewWindow || Boolean(this.getConfig('openInNewWindow'));

    await vscode.commands.executeCommand(
      'vscode.openFolder',
      vscode.Uri.file(folderPath),
      openInNewWindow
    );
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
}

function getCurrentWorkspacePaths(): string[] {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders) {
    return [];
  }
  return folders.map((f) => f.uri.fsPath);
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
