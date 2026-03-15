export interface RegisteredRoot {
  name: string;
  rootPath: string;
}

export interface GitWorktreeRecord {
  path: string;
  head?: string;
  branch?: string;
  detached: boolean;
  bare: boolean;
  locked?: string | true;
  prunable?: string | true;
}

export interface WorktreeFlags {
  isRegisteredRoot: boolean;
  isMainWorktree: boolean;
}

export type SharedFilesSyncMode = 'manual' | 'onCreate' | 'onCreateAndOpen' | 'off';

export interface SharedFilesSettingsSnapshot {
  sharedFiles: string[];
  syncMode: SharedFilesSyncMode;
  mainWorktreePath?: string;
}
