# Worktree Navigator

A VS Code extension for managing Git worktrees from a dedicated sidebar.

Korean documentation: [README.md](./README.md)

## Overview

Worktree Navigator lets you register multiple project roots, discover Git worktrees under each root, and open them from one place inside VS Code.
It also includes worktree creation and removal, shared-file sync, and local ignore editing so common multi-worktree tasks stay inside the editor.
I built this because I use Git worktrees heavily at work with `Claude Code` and `Codex`, and the existing VS Code extensions did not fit the workflow I actually wanted.

## Features

- Register and manage project roots
- Auto-discover Git repositories and worktrees under registered roots
- Show main, branch, detached, locked, and prunable states in the tree
- Open project roots and worktrees in the current window or a new one
- Create new worktrees from a registered project root
- Optionally delete the linked branch when removing a worktree
- Refresh automatically when the VS Code window regains focus
- Open a root quickly with double-click
- Register shared files from the main worktree and sync them into other worktrees
- Edit the common `.git/info/exclude` file shared by linked worktrees

## What You Can Do From the Sidebar

The activity bar container is named `Worktrees`, and the view is `Projects & Worktrees`.

- Add a root
- Refresh the tree
- Edit the saved roots file directly
- Open a project root in the current window or a new window
- Open a worktree in the current window or a new window
- Create and remove worktrees
- Add, remove, and sync shared files
- Change the shared-file sync mode
- Open the local ignore file

## Commands

| Command                                               | Description                                         |
| ----------------------------------------------------- | --------------------------------------------------- |
| `Worktree Navigator: Add Project Root`                | Register a project root.                            |
| `Worktree Navigator: Refresh`                         | Refresh the tree data.                              |
| `Worktree Navigator: Edit Saved Roots`                | Open the saved roots file directly.                 |
| `Worktree Navigator: Remove Project Root`             | Remove a registered project root.                   |
| `Worktree Navigator: Open Project Root`               | Open a project root in the current window.          |
| `Worktree Navigator: Open Project Root in New Window` | Open a project root in a new window.                |
| `Worktree Navigator: Open Worktree`                   | Open the selected worktree in the current window.   |
| `Worktree Navigator: Open Worktree in New Window`     | Open the selected worktree in a new window.         |
| `Worktree Navigator: Create Worktree`                 | Create a new worktree.                              |
| `Worktree Navigator: Remove Worktree`                 | Remove a worktree and optionally delete its branch. |
| `Worktree Navigator: Add Shared File`                 | Register a shared file from the main worktree.      |
| `Worktree Navigator: Remove Shared File`              | Remove a registered shared file.                    |
| `Worktree Navigator: Sync Shared Files`               | Run a manual shared-file sync.                      |
| `Worktree Navigator: Set Shared Files Sync Mode`      | Change the shared-file sync mode.                   |
| `Worktree Navigator: Edit Local Ignore File`          | Open the main/common `.git/info/exclude` file.      |

## Settings

| Setting                                      | Default  | Description                                                                         |
| -------------------------------------------- | -------- | ----------------------------------------------------------------------------------- |
| `worktreeNavigator.openInNewWindow`          | `false`  | Open project roots or worktrees in a new window by default.                         |
| `worktreeNavigator.doubleClickIntervalMs`    | `400`    | Maximum interval in milliseconds used to treat two clicks as a double-click.        |
| `worktreeNavigator.autoRefreshOnWindowFocus` | `true`   | Refresh the tree when the VS Code window regains focus.                             |
| `worktreeNavigator.enableRootDoubleClick`    | `true`   | Enable the experimental fast double-click behavior for opening a root.              |
| `worktreeNavigator.sharedFiles`              | `[]`     | Shared file paths relative to the main worktree.                                    |
| `worktreeNavigator.sharedFilesSyncMode`      | `manual` | Shared-file sync mode. Supports `manual`, `onCreate`, `onCreateAndOpen`, and `off`. |

## Shared File Sync

Shared files are managed from the main worktree.

- Metadata is stored in the main worktree's `.vscode/settings.json`.
- `manual`: sync only when you run the command.
- `onCreate`: sync automatically when a new worktree is created.
- `onCreateAndOpen`: sync automatically on create and on open.
- `off`: disable both automatic and manual sync.

This is useful for files such as `.env`, `.env.local`, `.npmrc`, or other local configuration files that should start from a shared baseline.

## Local Ignore

`Worktree Navigator: Edit Local Ignore File` opens `.git/info/exclude` in the Git common dir for the current root.
Because linked worktrees share that common dir, ignore rules edited there apply across the related worktree set.

## Storage and Behavior Notes

- Registered project roots are stored in `roots.json` under VS Code global storage.
- When the current workspace is a Git repository, the extension updates the window title to `parent/current (branch)`.
- Git commands are executed through `git` available on the system `PATH`.
- Worktrees are parsed from `git worktree list --porcelain -z`.

## Development

```bash
pnpm install
pnpm compile
pnpm lint
pnpm format:check
```

- Press `F5` to launch the Extension Development Host.
- Build output is generated in `out/`.
- See [PUBLISH.md](./PUBLISH.md) for Marketplace publishing notes.

## License

MIT
