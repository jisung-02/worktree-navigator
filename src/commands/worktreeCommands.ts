import * as path from 'node:path';
import * as vscode from 'vscode';
import {
  createWorktree,
  deleteBranch,
  findGitRoot,
  formatGitError,
  listBranches,
  readGitWorktrees,
  removeWorktree
} from '../git/worktreeService';
import { SharedFilesService } from '../shared/sharedFilesService';
import { ProjectRootItem, WorktreeItem } from '../view/items';

export interface WorktreeCommandContext {
  sharedFiles: SharedFilesService;
  refresh(): void;
  openFolder(folderPath: string, forceNewWindow: boolean): Promise<void>;
}

export async function openWorktree(
  ctx: WorktreeCommandContext,
  item: WorktreeItem | undefined,
  forceNewWindow: boolean
): Promise<void> {
  const worktreePath = item?.worktreePath;
  if (!worktreePath) {
    return;
  }

  await ctx.sharedFiles.prepareWorktreeForOpen(item.rootPath, worktreePath);
  await ctx.openFolder(worktreePath, forceNewWindow);
}

export async function removeWorktreeFromDialog(
  ctx: WorktreeCommandContext,
  item?: WorktreeItem
): Promise<void> {
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
    ctx.refresh();

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

export async function createWorktreeFromDialog(
  ctx: WorktreeCommandContext,
  item?: ProjectRootItem
): Promise<void> {
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
    ctx.refresh();
    const syncedOnCreate = await ctx.sharedFiles.syncCreatedWorktree(rootPath, worktreePath);
    const action = await vscode.window.showInformationMessage(
      `Worktree created: ${path.basename(worktreePath)}`,
      'Open',
      'Open in New Window'
    );
    if (action === 'Open') {
      if (!syncedOnCreate) {
        await ctx.sharedFiles.prepareWorktreeForOpen(rootPath, worktreePath);
      }
      await ctx.openFolder(worktreePath, false);
    } else if (action === 'Open in New Window') {
      if (!syncedOnCreate) {
        await ctx.sharedFiles.prepareWorktreeForOpen(rootPath, worktreePath);
      }
      await ctx.openFolder(worktreePath, true);
    }
  } catch (error) {
    await vscode.window.showErrorMessage(`Failed to create worktree: ${formatGitError(error)}`);
  }
}
