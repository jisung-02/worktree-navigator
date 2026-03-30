import * as vscode from 'vscode';
import { ProjectRootItem, TreeNode, WorktreeItem } from './items';
import { findBestPathMatch, getPreferredWorkspacePaths, isBetterMatch, MatchScore } from './workspaceMatch';

const WORKTREE_NAVIGATOR_VIEW_COMMAND = 'workbench.view.extension.worktreeNavigator';
const OPEN_SHORTCUTS_ACTION = 'Open Keyboard Shortcuts';
const ROOT_REVEAL_CYCLE_WINDOW_MS = 1500;

interface RootRevealCycleState {
  anchorRootPath: string;
  selectedRootPath: string;
  invokedAt: number;
}

export interface NavigationContext {
  treeView: vscode.TreeView<TreeNode> | undefined;
  getRootItems(): Promise<ProjectRootItem[]>;
  getWorktreeItems(rootPath: string): Promise<TreeNode[]>;
}

let rootRevealCycleState: RootRevealCycleState | undefined;

export async function revealCurrentRoot(ctx: NavigationContext): Promise<void> {
  const rootItems = await ctx.getRootItems();
  if (rootItems.length === 0) {
    rootRevealCycleState = undefined;
    await showNoCurrentItemMessage('root');
    return;
  }

  const anchorRootItem =
    findBestPathMatch(rootItems, (item) => item.rootPath)?.item ?? rootItems[0];
  const rootItem = getRootRevealTarget(rootItems, anchorRootItem);
  await focusNavigatorView();
  await collapsePreviouslyRevealedRoot(ctx, rootItems, rootItem);

  await ctx.treeView?.reveal(rootItem, {
    expand: true,
    focus: true,
    select: true
  });
  rootRevealCycleState = {
    anchorRootPath: anchorRootItem.rootPath,
    selectedRootPath: rootItem.rootPath,
    invokedAt: Date.now()
  };
}

export async function revealCurrentWorktree(ctx: NavigationContext): Promise<void> {
  const match = await findCurrentWorktreeItem(ctx);
  if (!match) {
    await showNoCurrentItemMessage('worktree');
    return;
  }

  await focusNavigatorView();
  await ctx.treeView?.reveal(match.rootItem, {
    expand: true,
    focus: false,
    select: false
  });
  await ctx.treeView?.reveal(match.worktreeItem, {
    focus: true,
    select: true
  });
}

function getRootRevealTarget(
  rootItems: ProjectRootItem[],
  currentRootItem: ProjectRootItem
): ProjectRootItem {
  const cycleState = rootRevealCycleState;
  if (
    !cycleState ||
    Date.now() - cycleState.invokedAt > ROOT_REVEAL_CYCLE_WINDOW_MS ||
    cycleState.anchorRootPath !== currentRootItem.rootPath
  ) {
    return currentRootItem;
  }

  const selectedIndex = rootItems.findIndex(
    (item) => item.rootPath === cycleState.selectedRootPath
  );
  if (selectedIndex === -1 || rootItems.length === 0) {
    return currentRootItem;
  }

  return rootItems[(selectedIndex + 1) % rootItems.length];
}

async function collapsePreviouslyRevealedRoot(
  ctx: NavigationContext,
  rootItems: ProjectRootItem[],
  nextRootItem: ProjectRootItem
): Promise<void> {
  const previousRootPath = rootRevealCycleState?.selectedRootPath;
  if (!previousRootPath || previousRootPath === nextRootItem.rootPath) {
    return;
  }

  const previousRootItem = rootItems.find((item) => item.rootPath === previousRootPath);
  if (!previousRootItem) {
    return;
  }

  await ctx.treeView?.reveal(previousRootItem, {
    focus: true,
    select: true
  });
  await vscode.commands.executeCommand('list.collapse');
}

async function findCurrentWorktreeItem(
  ctx: NavigationContext
): Promise<{ rootItem: ProjectRootItem; worktreeItem: WorktreeItem } | undefined> {
  const rootItems = await ctx.getRootItems();
  let bestMatch:
    | {
        rootItem: ProjectRootItem;
        worktreeItem: WorktreeItem;
        score: MatchScore;
      }
    | undefined;

  for (const rootItem of rootItems) {
    const children = await ctx.getWorktreeItems(rootItem.rootPath);
    const worktreeItems = children.filter(
      (child): child is WorktreeItem => child instanceof WorktreeItem
    );

    const nextMatch = findBestPathMatch(worktreeItems, (item) => item.worktreePath);
    if (!nextMatch) {
      continue;
    }

    if (!bestMatch || isBetterMatch(nextMatch.score, bestMatch.score)) {
      bestMatch = {
        rootItem,
        worktreeItem: nextMatch.item,
        score: nextMatch.score
      };
    }
  }

  if (!bestMatch) {
    return undefined;
  }

  return {
    rootItem: bestMatch.rootItem,
    worktreeItem: bestMatch.worktreeItem
  };
}

async function focusNavigatorView(): Promise<void> {
  await vscode.commands.executeCommand(WORKTREE_NAVIGATOR_VIEW_COMMAND);
}

async function showNoCurrentItemMessage(target: 'root' | 'worktree'): Promise<void> {
  const detail =
    getPreferredWorkspacePaths().length === 0
      ? 'Open a registered root or worktree first.'
      : target === 'root'
        ? 'The current workspace does not match any registered project root.'
        : 'The current workspace does not match any registered worktree.';
  const action = await vscode.window.showInformationMessage(detail, OPEN_SHORTCUTS_ACTION);
  if (action === OPEN_SHORTCUTS_ACTION) {
    await vscode.commands.executeCommand(
      'workbench.action.openGlobalKeybindings',
      'worktreeNavigator.revealCurrent'
    );
  }
}
