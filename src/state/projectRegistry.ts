import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { RegisteredRoot } from '../types';

interface RegistryFileShape {
  version?: number;
  roots?: Array<Partial<RegisteredRoot>>;
}

export class ProjectRegistry {
  public readonly filePath: string;

  constructor(private readonly context: vscode.ExtensionContext) {
    this.filePath = path.join(context.globalStorageUri.fsPath, 'roots.json');
  }

  async list(): Promise<RegisteredRoot[]> {
    await this.ensureStorageDir();

    try {
      const raw = await fs.readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw) as unknown;
      return normalizeRegistry(parsed);
    } catch (error) {
      if (isFileMissing(error)) {
        return [];
      }

      const message = error instanceof Error ? error.message : 'Unknown error';
      void vscode.window.showWarningMessage(
        `Worktree Navigator could not read roots.json: ${message}`
      );
      return [];
    }
  }

  async add(entry: RegisteredRoot): Promise<void> {
    const entries = await this.list();
    entries.push(entry);
    await this.save(entries);
  }

  async remove(rootPath: string): Promise<void> {
    const nextEntries = (await this.list()).filter((entry) => entry.rootPath !== rootPath);
    await this.save(nextEntries);
  }

  async openFileInEditor(): Promise<void> {
    await this.ensureStorageDir();

    try {
      await fs.access(this.filePath);
    } catch (error) {
      if (!isFileMissing(error)) {
        throw error;
      }

      await this.save([]);
    }

    const document = await vscode.workspace.openTextDocument(this.filePath);
    await vscode.window.showTextDocument(document, { preview: false });
  }

  private async save(entries: RegisteredRoot[]): Promise<void> {
    await this.ensureStorageDir();

    const normalized = entries
      .map((entry) => ({
        name: entry.name || path.basename(entry.rootPath) || entry.rootPath,
        rootPath: entry.rootPath
      }))
      .sort(
        (left, right) =>
          left.name.localeCompare(right.name) || left.rootPath.localeCompare(right.rootPath)
      );

    const payload = {
      version: 1,
      roots: normalized
    };

    await fs.writeFile(this.filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  }

  private async ensureStorageDir(): Promise<void> {
    await fs.mkdir(this.context.globalStorageUri.fsPath, { recursive: true });
  }
}

function normalizeRegistry(parsed: unknown): RegisteredRoot[] {
  if (Array.isArray(parsed)) {
    return parsed
      .filter((entry): entry is string => typeof entry === 'string')
      .map((rootPath) => ({
        name: path.basename(rootPath) || rootPath,
        rootPath
      }));
  }

  const fileShape = parsed as RegistryFileShape | null;
  if (!fileShape || !Array.isArray(fileShape.roots)) {
    return [];
  }

  return fileShape.roots
    .filter((entry): entry is RegisteredRoot =>
      Boolean(entry && typeof entry.rootPath === 'string')
    )
    .map((entry) => ({
      name:
        typeof entry.name === 'string' && entry.name.trim()
          ? entry.name.trim()
          : path.basename(entry.rootPath) || entry.rootPath,
      rootPath: entry.rootPath
    }));
}

function isFileMissing(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT');
}
