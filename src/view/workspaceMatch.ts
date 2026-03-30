import * as path from 'node:path';
import * as vscode from 'vscode';
import { normalizeComparablePath } from '../utils/pathUtils';

export interface MatchScore {
  exact: boolean;
  pathLength: number;
  workspaceIndex: number;
}

export function getCurrentWorkspacePaths(): string[] {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders) {
    return [];
  }
  return folders.map((f) => f.uri.fsPath);
}

export function getPreferredWorkspacePaths(): string[] {
  const currentPaths = getCurrentWorkspacePaths();
  const activePath = getActiveWorkspacePath();
  if (!activePath) {
    return currentPaths;
  }

  const normalizedActivePath = normalizeComparablePath(activePath);
  return [
    activePath,
    ...currentPaths.filter(
      (pathValue) => normalizeComparablePath(pathValue) !== normalizedActivePath
    )
  ];
}

export function getActiveWorkspacePath(): string | undefined {
  const activeUri = vscode.window.activeTextEditor?.document.uri;
  if (!activeUri || activeUri.scheme !== 'file') {
    return undefined;
  }

  return vscode.workspace.getWorkspaceFolder(activeUri)?.uri.fsPath;
}

export function findBestPathMatch<T>(
  items: T[],
  getPath: (item: T) => string
): { item: T; score: MatchScore } | undefined {
  const workspacePaths = getPreferredWorkspacePaths();
  let bestMatch: { item: T; score: MatchScore } | undefined;

  for (const [workspaceIndex, workspacePath] of workspacePaths.entries()) {
    for (const item of items) {
      const match = matchWorkspacePath(getPath(item), workspacePath);
      if (!match) {
        continue;
      }

      const score: MatchScore = {
        exact: match.exact,
        pathLength: match.pathLength,
        workspaceIndex
      };

      if (!bestMatch || isBetterMatch(score, bestMatch.score)) {
        bestMatch = { item, score };
      }
    }
  }

  return bestMatch;
}

export function isBetterMatch(left: MatchScore, right: MatchScore): boolean {
  if (left.exact !== right.exact) {
    return left.exact;
  }

  if (left.pathLength !== right.pathLength) {
    return left.pathLength > right.pathLength;
  }

  return left.workspaceIndex < right.workspaceIndex;
}

function matchWorkspacePath(
  candidatePath: string,
  workspacePath: string
): { exact: boolean; pathLength: number } | undefined {
  const normalizedCandidate = normalizeComparablePath(candidatePath);
  const normalizedWorkspace = normalizeComparablePath(workspacePath);

  if (normalizedCandidate === normalizedWorkspace) {
    return {
      exact: true,
      pathLength: normalizedCandidate.length
    };
  }

  if (normalizedWorkspace.startsWith(normalizedCandidate + path.sep)) {
    return {
      exact: false,
      pathLength: normalizedCandidate.length
    };
  }

  return undefined;
}
