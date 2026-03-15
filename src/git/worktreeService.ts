import { execFile } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import * as path from 'node:path';
import { promisify } from 'node:util';
import { GitWorktreeRecord } from '../types';

const execFileAsync = promisify(execFile);
const gitRootCache = new Map<string, string>();
const gitCommonDirCache = new Map<string, string>();
const worktreeListCache = new Map<string, GitWorktreeRecord[]>();
const worktreeListInflight = new Map<string, Promise<GitWorktreeRecord[]>>();

export async function readGitWorktrees(repoPath: string): Promise<GitWorktreeRecord[]> {
  return refreshGitWorktrees(repoPath);
}

export async function readCachedGitWorktrees(repoPath: string): Promise<GitWorktreeRecord[]> {
  const gitRoot = await findGitRoot(repoPath);
  const cached = worktreeListCache.get(gitRoot);
  if (cached) {
    return cached;
  }

  return refreshGitWorktrees(gitRoot);
}

export async function refreshGitWorktrees(repoPath: string): Promise<GitWorktreeRecord[]> {
  const gitRoot = await findGitRoot(repoPath);
  const inflight = worktreeListInflight.get(gitRoot);
  if (inflight) {
    return inflight;
  }

  const request = readGitWorktreesFromGit(gitRoot)
    .then((records) => {
      worktreeListCache.set(gitRoot, records);
      return records;
    })
    .finally(() => {
      worktreeListInflight.delete(gitRoot);
    });

  worktreeListInflight.set(gitRoot, request);
  return request;
}

export function invalidateGitWorktreeCache(): void {
  worktreeListCache.clear();
  worktreeListInflight.clear();
}

export async function getGitCommonDir(repoPath: string): Promise<string> {
  const gitRoot = await findGitRoot(repoPath);
  const cached = gitCommonDirCache.get(gitRoot);
  if (cached) {
    return cached;
  }

  const { stdout } = await execFileAsync('git', ['-C', gitRoot, 'rev-parse', '--git-common-dir'], {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024
  });

  const resolved = resolveGitPath(gitRoot, stdout.trim());
  gitCommonDirCache.set(gitRoot, resolved);
  return resolved;
}

export async function getGitInfoExcludePath(repoPath: string): Promise<string> {
  return path.join(await getGitCommonDir(repoPath), 'info', 'exclude');
}

async function readGitWorktreesFromGit(gitRoot: string): Promise<GitWorktreeRecord[]> {
  const { stdout } = await execFileAsync(
    'git',
    ['-C', gitRoot, 'worktree', 'list', '--porcelain', '-z'],
    {
      encoding: 'utf8',
      maxBuffer: 1024 * 1024
    }
  );

  return parseWorktreePorcelain(stdout);
}

export function hasGitRepo(repoPath: string): boolean {
  if (existsSync(path.join(repoPath, '.git'))) {
    return true;
  }
  try {
    const entries = readdirSync(repoPath, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) {
        continue;
      }
      const dotGit = path.join(repoPath, entry.name, '.git');
      if (existsSync(dotGit)) {
        return true;
      }
    }
  } catch {
    // ignore
  }
  return false;
}

export async function findGitRoot(repoPath: string): Promise<string> {
  const cached = gitRootCache.get(repoPath);
  if (cached) {
    return cached;
  }
  // 1) 해당 경로 자체가 git repo인지 확인
  if (existsSync(path.join(repoPath, '.git'))) {
    gitRootCache.set(repoPath, repoPath);
    return repoPath;
  }

  // 2) 즉시 하위 디렉토리 중 .git을 가진 것을 탐색
  try {
    const entries = readdirSync(repoPath, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) {
        continue;
      }
      const child = path.join(repoPath, entry.name);
      const dotGit = path.join(child, '.git');
      if (existsSync(dotGit) && statSync(dotGit).isDirectory()) {
        gitRootCache.set(repoPath, child);
        return child;
      }
    }
  } catch {
    // 읽기 실패 시 원래 경로로 폴백
  }

  gitRootCache.set(repoPath, repoPath);
  return repoPath;
}

export function parseWorktreePorcelain(stdout: string): GitWorktreeRecord[] {
  const records: GitWorktreeRecord[] = [];
  let current: GitWorktreeRecord | undefined;

  for (const token of stdout.split('\0')) {
    if (!token) {
      if (current?.path) {
        records.push(current);
      }

      current = undefined;
      continue;
    }

    const separatorIndex = token.indexOf(' ');
    const key = separatorIndex === -1 ? token : token.slice(0, separatorIndex);
    const value = separatorIndex === -1 ? '' : token.slice(separatorIndex + 1);

    if (key === 'worktree') {
      if (current?.path) {
        records.push(current);
      }

      current = {
        path: value,
        head: undefined,
        branch: undefined,
        detached: false,
        bare: false,
        locked: undefined,
        prunable: undefined
      };
      continue;
    }

    if (!current) {
      continue;
    }

    switch (key) {
      case 'HEAD':
        current.head = value;
        break;
      case 'branch':
        current.branch = value.replace(/^refs\/heads\//, '');
        break;
      case 'detached':
        current.detached = true;
        break;
      case 'bare':
        current.bare = true;
        break;
      case 'locked':
        current.locked = value || true;
        break;
      case 'prunable':
        current.prunable = value || true;
        break;
      default:
        break;
    }
  }

  if (current?.path) {
    records.push(current);
  }

  return records;
}

export interface CreateWorktreeOptions {
  repoPath: string;
  worktreePath: string;
  branch: string;
  createNewBranch: boolean;
  baseBranch?: string;
}

export async function listBranches(
  repoPath: string
): Promise<{ local: string[]; remote: string[] }> {
  const gitRoot = await findGitRoot(repoPath);

  const [localResult, remoteResult] = await Promise.all([
    execFileAsync('git', ['-C', gitRoot, 'branch', '--format=%(refname:short)'], {
      encoding: 'utf8',
      maxBuffer: 1024 * 1024
    }),
    execFileAsync('git', ['-C', gitRoot, 'branch', '-r', '--format=%(refname:short)'], {
      encoding: 'utf8',
      maxBuffer: 1024 * 1024
    })
  ]);

  const local = localResult.stdout.split('\n').filter(Boolean);
  const remote = remoteResult.stdout.split('\n').filter(Boolean);
  return { local, remote };
}

export async function createWorktree(options: CreateWorktreeOptions): Promise<void> {
  const gitRoot = await findGitRoot(options.repoPath);

  const args = ['-C', gitRoot, 'worktree', 'add'];

  if (options.createNewBranch) {
    args.push('-b', options.branch, options.worktreePath);
    if (options.baseBranch) {
      args.push(options.baseBranch);
    }
  } else {
    args.push(options.worktreePath, options.branch);
  }

  await execFileAsync('git', args, {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024
  });

  gitRootCache.clear();
  gitCommonDirCache.clear();
  invalidateGitWorktreeCache();
}

export async function removeWorktree(
  repoPath: string,
  worktreePath: string,
  force: boolean
): Promise<void> {
  const gitRoot = await findGitRoot(repoPath);
  const args = ['-C', gitRoot, 'worktree', 'remove', ...(force ? ['--force'] : []), worktreePath];

  await execFileAsync('git', args, {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024
  });

  gitRootCache.clear();
  gitCommonDirCache.clear();
  invalidateGitWorktreeCache();
}

export async function deleteBranch(
  repoPath: string,
  branch: string,
  force: boolean
): Promise<void> {
  const gitRoot = await findGitRoot(repoPath);
  const flag = force ? '-D' : '-d';
  await execFileAsync('git', ['-C', gitRoot, 'branch', flag, branch], {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024
  });
}

export async function getCurrentBranch(repoPath: string): Promise<string | undefined> {
  try {
    const { stdout } = await execFileAsync(
      'git',
      ['-C', repoPath, 'rev-parse', '--abbrev-ref', 'HEAD'],
      { encoding: 'utf8', maxBuffer: 1024 * 1024 }
    );
    const branch = stdout.trim();
    return branch && branch !== 'HEAD' ? branch : undefined;
  } catch {
    return undefined;
  }
}

export function isGitWorktreeDir(dirPath: string): boolean {
  const dotGit = path.join(dirPath, '.git');
  try {
    const stat = statSync(dotGit);
    // worktree의 .git은 파일(gitdir 포인터)이지 디렉터리가 아님
    return stat.isFile();
  } catch {
    return false;
  }
}

export function formatGitError(error: unknown): string {
  if (error && typeof error === 'object' && 'stderr' in error && typeof error.stderr === 'string') {
    return error.stderr.trim() || 'Git command failed.';
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Git command failed.';
}

function resolveGitPath(gitRoot: string, gitPath: string): string {
  if (!gitPath) {
    return gitRoot;
  }

  return path.isAbsolute(gitPath) ? gitPath : path.resolve(gitRoot, gitPath);
}
