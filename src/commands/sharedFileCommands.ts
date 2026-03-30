import { SharedFilesService } from '../shared/sharedFilesService';
import { ProjectRootItem, SharedFileItem, SharedFilesGroupItem } from '../view/items';

export interface SharedFileCommandContext {
  sharedFiles: SharedFilesService;
  refresh(): void;
}

export async function addSharedFile(
  ctx: SharedFileCommandContext,
  item?: ProjectRootItem | SharedFilesGroupItem
): Promise<void> {
  if (await ctx.sharedFiles.addSharedFile(item?.rootPath)) {
    ctx.refresh();
  }
}

export async function removeSharedFile(
  ctx: SharedFileCommandContext,
  item?: ProjectRootItem | SharedFilesGroupItem | SharedFileItem
): Promise<void> {
  const rootPath = item?.rootPath;
  const relativePath = item instanceof SharedFileItem ? item.relativePath : undefined;
  if (await ctx.sharedFiles.removeSharedFile(rootPath, relativePath)) {
    ctx.refresh();
  }
}

export async function changeSharedFilesSyncMode(
  ctx: SharedFileCommandContext,
  item?: ProjectRootItem | SharedFilesGroupItem
): Promise<void> {
  if (await ctx.sharedFiles.changeSyncMode(item?.rootPath)) {
    ctx.refresh();
  }
}

export async function syncSharedFilesNow(
  ctx: SharedFileCommandContext,
  item?: ProjectRootItem | SharedFilesGroupItem
): Promise<void> {
  if (await ctx.sharedFiles.syncNow(item?.rootPath)) {
    ctx.refresh();
  }
}
