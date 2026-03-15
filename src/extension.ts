import * as path from 'node:path';
import * as vscode from 'vscode';
import { getCurrentBranch, parseWorktreePorcelain } from './git/worktreeService';
import { SharedFilesService } from './shared/sharedFilesService';
import { ProjectRegistry } from './state/projectRegistry';
import {
  ProjectRootItem,
  SharedFileItem,
  SharedFilesGroupItem,
  TreeNode,
  WorktreeItem
} from './view/items';
import { WorktreeProvider } from './view/worktreeProvider';

const VIEW_ID = 'worktreeNavigator.projects';

export function activate(context: vscode.ExtensionContext): void {
  const registry = new ProjectRegistry(context);
  const sharedFiles = new SharedFilesService(registry);
  const provider = new WorktreeProvider(registry, sharedFiles, context.extensionUri);
  const treeView = vscode.window.createTreeView<TreeNode>(VIEW_ID, {
    treeDataProvider: provider,
    showCollapseAll: true
  });

  provider.attachTreeView(treeView);

  // 현재 워크스페이스가 git repo면 타이틀을 부모/현재(브랜치) 형식으로 변경
  updateWorktreeWindowTitle();

  context.subscriptions.push(
    treeView,
    vscode.commands.registerCommand('worktreeNavigator.addRoot', async () => {
      await provider.addRootFromDialog();
    }),
    vscode.commands.registerCommand('worktreeNavigator.refresh', () => {
      provider.refresh();
    }),
    vscode.commands.registerCommand('worktreeNavigator.openRegistryFile', async () => {
      await registry.openFileInEditor();
    }),
    vscode.commands.registerCommand(
      'worktreeNavigator.removeRoot',
      async (item?: ProjectRootItem) => {
        await provider.removeRoot(item);
      }
    ),
    vscode.commands.registerCommand(
      'worktreeNavigator.openRoot',
      async (item?: ProjectRootItem) => {
        await provider.openRoot(item, false);
      }
    ),
    vscode.commands.registerCommand(
      'worktreeNavigator.openRootInNewWindow',
      async (item?: ProjectRootItem) => {
        await provider.openRoot(item, true);
      }
    ),
    vscode.commands.registerCommand(
      'worktreeNavigator.openWorktree',
      async (item?: WorktreeItem) => {
        await provider.openWorktree(item, false);
      }
    ),
    vscode.commands.registerCommand(
      'worktreeNavigator.openWorktreeInNewWindow',
      async (item?: WorktreeItem) => {
        await provider.openWorktree(item, true);
      }
    ),
    vscode.commands.registerCommand(
      'worktreeNavigator.removeWorktree',
      async (item?: WorktreeItem) => {
        await provider.removeWorktreeFromDialog(item);
      }
    ),
    vscode.commands.registerCommand(
      'worktreeNavigator.createWorktree',
      async (item?: ProjectRootItem) => {
        await provider.createWorktreeFromDialog(item);
      }
    ),
    vscode.commands.registerCommand(
      'worktreeNavigator.handleRootClick',
      async (item?: ProjectRootItem) => {
        await provider.handleRootClick(item);
      }
    ),
    vscode.commands.registerCommand(
      'worktreeNavigator.addSharedFile',
      async (item?: ProjectRootItem | SharedFilesGroupItem) => {
        await provider.addSharedFile(item);
      }
    ),
    vscode.commands.registerCommand(
      'worktreeNavigator.removeSharedFile',
      async (item?: ProjectRootItem | SharedFilesGroupItem | SharedFileItem) => {
        await provider.removeSharedFile(item);
      }
    ),
    vscode.commands.registerCommand(
      'worktreeNavigator.syncSharedFiles',
      async (item?: ProjectRootItem | SharedFilesGroupItem) => {
        await provider.syncSharedFilesNow(item);
      }
    ),
    vscode.commands.registerCommand(
      'worktreeNavigator.setSharedFilesSyncMode',
      async (item?: ProjectRootItem | SharedFilesGroupItem) => {
        await provider.changeSharedFilesSyncMode(item);
      }
    ),
    vscode.commands.registerCommand(
      'worktreeNavigator.openLocalIgnoreFile',
      async (item?: ProjectRootItem) => {
        await provider.openLocalIgnoreFile(item);
      }
    ),
    vscode.commands.registerCommand('worktreeNavigator.revealCurrentRoot', async () => {
      await provider.revealCurrentRoot();
    }),
    vscode.commands.registerCommand('worktreeNavigator.revealCurrentWorktree', async () => {
      await provider.revealCurrentWorktree();
    }),
    vscode.commands.registerCommand('worktreeNavigator.openShortcutHelp', async () => {
      await provider.openShortcutHelp();
    }),
    vscode.commands.registerCommand('worktreeNavigator.openHelp', async () => {
      await provider.openHelp();
    }),
    vscode.workspace.onDidSaveTextDocument((document) => {
      if (document.uri.fsPath === registry.filePath) {
        provider.refresh();
      }
    }),
    vscode.workspace.onDidChangeWorkspaceFolders((event) => {
      void sharedFiles.syncAddedWorkspaceFolders(event.added);
      provider.refresh();
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('worktreeNavigator')) {
        provider.refresh();
      }
    }),
    vscode.window.onDidChangeWindowState((state) => {
      if (state.focused && provider.getConfig('autoRefreshOnWindowFocus')) {
        provider.softRefresh();
      }
    })
  );

  void sharedFiles.syncCurrentWorkspaceIfNeeded('activate');
}

export function deactivate(): void {}

async function updateWorktreeWindowTitle(): Promise<void> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    return;
  }

  const folder = folders[0];
  const fsPath = folder.uri.fsPath;

  const { existsSync } = await import('node:fs');
  if (!existsSync(path.join(fsPath, '.git'))) {
    return;
  }

  const branch = await getCurrentBranch(fsPath);
  if (!branch) {
    return;
  }

  const currentDir = path.basename(fsPath);
  const parentDir = path.basename(path.dirname(fsPath));
  const customName = `${parentDir}/${currentDir} (${branch})`;

  const config = vscode.workspace.getConfiguration('window');
  const defaultTitle =
    '${dirty}${activeEditorShort}${separator}${rootName}${separator}${profileName}${separator}${appName}';
  const newTitle = defaultTitle.replace('${rootName}', customName);

  await config.update('title', newTitle, vscode.ConfigurationTarget.Workspace);
}

export { parseWorktreePorcelain };
