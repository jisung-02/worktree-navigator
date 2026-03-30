import * as fs from 'node:fs/promises';
import * as vscode from 'vscode';
import {
  HELP_CATEGORIES,
  HelpActionDefinition,
  HelpCategoryDefinition,
  HelpTopicDefinition
} from '../help/helpContent';

interface HelpCategoryPickItem extends vscode.QuickPickItem {
  category: HelpCategoryDefinition;
}

interface HelpTopicPickItem extends vscode.QuickPickItem {
  topic: HelpTopicDefinition;
}

interface HelpActionPickItem extends vscode.QuickPickItem {
  action: HelpActionDefinition;
}

export async function openHelp(extensionUri: vscode.Uri): Promise<void> {
  for (;;) {
    const category = await pickHelpCategory();
    if (!category) {
      return;
    }

    const topic = await pickHelpTopic(category);
    if (!topic) {
      continue;
    }

    const action =
      topic.actions.length === 1 ? topic.actions[0] : await pickHelpAction(category, topic);
    if (!action) {
      continue;
    }

    await runHelpAction(action, extensionUri);
    return;
  }
}

export async function openShortcutHelp(): Promise<void> {
  await vscode.commands.executeCommand(
    'workbench.action.openGlobalKeybindings',
    'worktreeNavigator.revealCurrent'
  );
}

async function pickHelpCategory(): Promise<HelpCategoryDefinition | undefined> {
  const items: HelpCategoryPickItem[] = HELP_CATEGORIES.map((category) => ({
    label: category.label,
    description: category.description,
    detail: `${category.topics.length} topic${category.topics.length === 1 ? '' : 's'}`,
    category
  }));

  const picked = await vscode.window.showQuickPick(items, {
    placeHolder: 'Worktree Navigator Help',
    matchOnDescription: true,
    matchOnDetail: true
  });

  return picked?.category;
}

async function pickHelpTopic(
  category: HelpCategoryDefinition
): Promise<HelpTopicDefinition | undefined> {
  const items: HelpTopicPickItem[] = category.topics.map((topic) => ({
    label: topic.label,
    description: topic.description,
    detail: topic.detail,
    topic
  }));

  const picked = await vscode.window.showQuickPick(items, {
    placeHolder: `${category.label} Help`,
    matchOnDescription: true,
    matchOnDetail: true
  });

  return picked?.topic;
}

async function pickHelpAction(
  category: HelpCategoryDefinition,
  topic: HelpTopicDefinition
): Promise<HelpActionDefinition | undefined> {
  const items: HelpActionPickItem[] = topic.actions.map((action) => ({
    label: action.label,
    description: action.description,
    detail: topic.detail,
    action
  }));

  const picked = await vscode.window.showQuickPick(items, {
    placeHolder: `${category.label} > ${topic.label}`,
    matchOnDescription: true,
    matchOnDetail: true
  });

  return picked?.action;
}

async function runHelpAction(
  action: HelpActionDefinition,
  extensionUri: vscode.Uri
): Promise<void> {
  if (action.kind === 'readme') {
    await openBundledReadme(extensionUri);
    return;
  }

  await vscode.commands.executeCommand(action.commandId, ...(action.commandArgs ?? []));
}

async function openBundledReadme(extensionUri: vscode.Uri): Promise<void> {
  const preferredName = vscode.env.language.startsWith('ko') ? 'README.md' : 'README.en.md';
  const fallbackName = preferredName === 'README.md' ? 'README.en.md' : 'README.md';
  const candidates = [preferredName, fallbackName];

  for (const fileName of candidates) {
    const readmeUri = vscode.Uri.joinPath(extensionUri, fileName);
    try {
      await fs.access(readmeUri.fsPath);
      const document = await vscode.workspace.openTextDocument(readmeUri);
      await vscode.window.showTextDocument(document, { preview: false });
      return;
    } catch {
      // try the fallback file next
    }
  }

  await vscode.window.showErrorMessage('Failed to open the bundled README file.');
}
