export type HelpActionDefinition =
  | {
      kind: 'command';
      label: string;
      description: string;
      commandId: string;
      commandArgs?: unknown[];
    }
  | {
      kind: 'readme';
      label: string;
      description: string;
    };

export interface HelpTopicDefinition {
  id: string;
  label: string;
  description: string;
  detail: string;
  actions: HelpActionDefinition[];
}

export interface HelpCategoryDefinition {
  id: string;
  label: string;
  description: string;
  topics: HelpTopicDefinition[];
}

export const HELP_CATEGORIES: HelpCategoryDefinition[] = [
  {
    id: 'start-here',
    label: 'Start Here',
    description: 'Overview and first steps',
    topics: [
      {
        id: 'overview',
        label: 'What Worktree Navigator does',
        description: 'Sidebar-based Git worktree management',
        detail:
          'Register project roots, browse Git worktrees, open them quickly, and manage shared local files without leaving VS Code.',
        actions: [
          {
            kind: 'command',
            label: 'Focus Worktrees Sidebar',
            description: 'Open the dedicated sidebar',
            commandId: 'workbench.view.extension.worktreeNavigator'
          },
          {
            kind: 'readme',
            label: 'Open README',
            description: 'Read the full feature guide'
          }
        ]
      },
      {
        id: 'first-root',
        label: 'Register your first project root',
        description: 'Start by adding a Git project root',
        detail:
          'The extension works from registered roots. Once a root is added, its Git worktrees appear under the Worktrees sidebar.',
        actions: [
          {
            kind: 'command',
            label: 'Add Project Root',
            description: 'Pick a folder and register it',
            commandId: 'worktreeNavigator.addRoot'
          },
          {
            kind: 'command',
            label: 'Edit Saved Roots',
            description: 'Open the persisted roots list directly',
            commandId: 'worktreeNavigator.openRegistryFile'
          }
        ]
      },
      {
        id: 'find-current',
        label: 'Find the current workspace in the sidebar',
        description: 'Reveal the matching root or worktree',
        detail:
          'Use the reveal commands to jump the sidebar selection to the current root or worktree when you are already inside one.',
        actions: [
          {
            kind: 'command',
            label: 'Reveal Current Root',
            description: 'Select the current project root',
            commandId: 'worktreeNavigator.revealCurrentRoot'
          },
          {
            kind: 'command',
            label: 'Reveal Current Worktree',
            description: 'Select the current worktree',
            commandId: 'worktreeNavigator.revealCurrentWorktree'
          },
          {
            kind: 'command',
            label: 'Open Shortcut Help',
            description: 'Review or rebind shortcuts',
            commandId: 'worktreeNavigator.openShortcutHelp'
          }
        ]
      }
    ]
  },
  {
    id: 'project-roots',
    label: 'Project Roots',
    description: 'Register, open, refresh, and remove roots',
    topics: [
      {
        id: 'add-root',
        label: 'Add Project Root',
        description: 'Register a root from a folder picker',
        detail:
          'Adding a root makes the extension track that repository and list its worktrees in the sidebar.',
        actions: [
          {
            kind: 'command',
            label: 'Run Add Project Root',
            description: 'Register a new project root',
            commandId: 'worktreeNavigator.addRoot'
          }
        ]
      },
      {
        id: 'refresh',
        label: 'Refresh',
        description: 'Reload roots and worktrees',
        detail:
          'Refresh re-reads the current tree state. Auto refresh on focus is also available in settings.',
        actions: [
          {
            kind: 'command',
            label: 'Run Refresh',
            description: 'Refresh the tree now',
            commandId: 'worktreeNavigator.refresh'
          },
          {
            kind: 'command',
            label: 'Open Auto Refresh Setting',
            description: 'Search the related setting',
            commandId: 'workbench.action.openSettings',
            commandArgs: ['worktreeNavigator.autoRefreshOnWindowFocus']
          }
        ]
      },
      {
        id: 'saved-roots',
        label: 'Edit Saved Roots',
        description: 'Open the persisted roots file directly',
        detail:
          'Use this when you want to inspect or edit the saved root list without using the sidebar picker again.',
        actions: [
          {
            kind: 'command',
            label: 'Open Saved Roots File',
            description: 'Edit the stored roots list',
            commandId: 'worktreeNavigator.openRegistryFile'
          }
        ]
      },
      {
        id: 'open-root',
        label: 'Open Project Root',
        description: 'Open a selected root from the sidebar',
        detail:
          'This command needs a project root item selection in the sidebar. Use the sidebar or reveal the current root first.',
        actions: [
          {
            kind: 'command',
            label: 'Focus Worktrees Sidebar',
            description: 'Go to the sidebar first',
            commandId: 'workbench.view.extension.worktreeNavigator'
          },
          {
            kind: 'command',
            label: 'Reveal Current Root',
            description: 'Select the current root if available',
            commandId: 'worktreeNavigator.revealCurrentRoot'
          }
        ]
      },
      {
        id: 'open-root-new-window',
        label: 'Open Project Root in New Window',
        description: 'Open a selected root in another window',
        detail:
          'Run this from a root item context menu when you want to keep the current window intact.',
        actions: [
          {
            kind: 'command',
            label: 'Focus Worktrees Sidebar',
            description: 'Go to the sidebar first',
            commandId: 'workbench.view.extension.worktreeNavigator'
          },
          {
            kind: 'command',
            label: 'Open New Window Setting',
            description: 'Review the default open behavior',
            commandId: 'workbench.action.openSettings',
            commandArgs: ['worktreeNavigator.openInNewWindow']
          }
        ]
      },
      {
        id: 'remove-root',
        label: 'Remove Project Root',
        description: 'Remove a registered root from the tree',
        detail:
          'Removing a root only unregisters it from the extension. It does not delete files from disk.',
        actions: [
          {
            kind: 'command',
            label: 'Focus Worktrees Sidebar',
            description: 'Open the root context menu from the sidebar',
            commandId: 'workbench.view.extension.worktreeNavigator'
          }
        ]
      }
    ]
  },
  {
    id: 'worktrees',
    label: 'Worktrees',
    description: 'Create, open, reveal, and remove worktrees',
    topics: [
      {
        id: 'open-worktree',
        label: 'Open Worktree',
        description: 'Open the selected worktree in the current window',
        detail:
          'Select a worktree item in the sidebar and press Enter or use the context menu to open it.',
        actions: [
          {
            kind: 'command',
            label: 'Focus Worktrees Sidebar',
            description: 'Go to the sidebar first',
            commandId: 'workbench.view.extension.worktreeNavigator'
          },
          {
            kind: 'command',
            label: 'Reveal Current Worktree',
            description: 'Select the current worktree if available',
            commandId: 'worktreeNavigator.revealCurrentWorktree'
          }
        ]
      },
      {
        id: 'open-worktree-new-window',
        label: 'Open Worktree in New Window',
        description: 'Open the selected worktree in another window',
        detail:
          'Use this from the worktree context menu when you want to keep your current workspace open.',
        actions: [
          {
            kind: 'command',
            label: 'Focus Worktrees Sidebar',
            description: 'Go to the sidebar first',
            commandId: 'workbench.view.extension.worktreeNavigator'
          },
          {
            kind: 'command',
            label: 'Open New Window Setting',
            description: 'Review the default open behavior',
            commandId: 'workbench.action.openSettings',
            commandArgs: ['worktreeNavigator.openInNewWindow']
          }
        ]
      },
      {
        id: 'create-worktree',
        label: 'Create Worktree',
        description: 'Create a new worktree from a registered root',
        detail:
          'Pick a root, choose new or existing branch mode, then set the target directory for the worktree.',
        actions: [
          {
            kind: 'command',
            label: 'Reveal Current Root',
            description: 'Select the matching root when possible',
            commandId: 'worktreeNavigator.revealCurrentRoot'
          },
          {
            kind: 'command',
            label: 'Focus Worktrees Sidebar',
            description: 'Create from a root item context menu',
            commandId: 'workbench.view.extension.worktreeNavigator'
          }
        ]
      },
      {
        id: 'remove-worktree',
        label: 'Remove Worktree',
        description: 'Remove a worktree and optionally its branch',
        detail:
          'The remove flow asks for confirmation and can optionally delete the linked branch after removing the worktree.',
        actions: [
          {
            kind: 'command',
            label: 'Reveal Current Worktree',
            description: 'Select the current worktree when possible',
            commandId: 'worktreeNavigator.revealCurrentWorktree'
          },
          {
            kind: 'command',
            label: 'Focus Worktrees Sidebar',
            description: 'Open the worktree context menu from the sidebar',
            commandId: 'workbench.view.extension.worktreeNavigator'
          }
        ]
      },
      {
        id: 'reveal-current-root',
        label: 'Reveal Current Root in Sidebar',
        description: 'Jump to the current root',
        detail:
          'This is useful when you already opened a workspace and want to find its registered root quickly in the sidebar.',
        actions: [
          {
            kind: 'command',
            label: 'Run Reveal Current Root',
            description: 'Select the current root in the sidebar',
            commandId: 'worktreeNavigator.revealCurrentRoot'
          },
          {
            kind: 'command',
            label: 'Open Shortcut Help',
            description: 'Review the shortcut binding',
            commandId: 'worktreeNavigator.openShortcutHelp'
          }
        ]
      },
      {
        id: 'reveal-current-worktree',
        label: 'Reveal Current Worktree in Sidebar',
        description: 'Jump to the current worktree',
        detail:
          'This reveals the matching worktree item beneath its root so you can inspect or act on it immediately.',
        actions: [
          {
            kind: 'command',
            label: 'Run Reveal Current Worktree',
            description: 'Select the current worktree in the sidebar',
            commandId: 'worktreeNavigator.revealCurrentWorktree'
          },
          {
            kind: 'command',
            label: 'Focus Worktrees Sidebar',
            description: 'Open the sidebar first',
            commandId: 'workbench.view.extension.worktreeNavigator'
          }
        ]
      }
    ]
  },
  {
    id: 'shared-files',
    label: 'Shared Files',
    description: 'Sync selected files from the main worktree',
    topics: [
      {
        id: 'add-shared-file',
        label: 'Add Shared File',
        description: 'Register files from the main worktree',
        detail:
          'Shared files are stored in the main worktree settings and can be copied into linked worktrees when you create, open, or sync them.',
        actions: [
          {
            kind: 'command',
            label: 'Run Add Shared File',
            description: 'Pick files from the main worktree',
            commandId: 'worktreeNavigator.addSharedFile'
          },
          {
            kind: 'command',
            label: 'Open Shared Files Setting',
            description: 'Search the shared files setting',
            commandId: 'workbench.action.openSettings',
            commandArgs: ['worktreeNavigator.sharedFiles']
          }
        ]
      },
      {
        id: 'remove-shared-file',
        label: 'Remove Shared File',
        description: 'Remove a registered shared file',
        detail:
          'When run from a matching workspace, the extension lets you choose which shared file to unregister.',
        actions: [
          {
            kind: 'command',
            label: 'Run Remove Shared File',
            description: 'Pick a registered shared file to remove',
            commandId: 'worktreeNavigator.removeSharedFile'
          }
        ]
      },
      {
        id: 'sync-shared-files',
        label: 'Sync Shared Files',
        description: 'Copy shared files into another worktree',
        detail:
          'Manual sync copies the registered files from the main worktree into a selected secondary worktree.',
        actions: [
          {
            kind: 'command',
            label: 'Run Sync Shared Files',
            description: 'Start a manual sync flow',
            commandId: 'worktreeNavigator.syncSharedFiles'
          },
          {
            kind: 'command',
            label: 'Open Shared Files Sync Mode Setting',
            description: 'Review the available sync modes',
            commandId: 'workbench.action.openSettings',
            commandArgs: ['worktreeNavigator.sharedFilesSyncMode']
          }
        ]
      },
      {
        id: 'shared-file-sync-mode',
        label: 'Set Shared Files Sync Mode',
        description: 'Choose manual, on-create, on-open, or off',
        detail:
          'The sync mode decides when shared files are copied automatically and whether manual sync stays available.',
        actions: [
          {
            kind: 'command',
            label: 'Run Set Shared Files Sync Mode',
            description: 'Choose the current sync mode',
            commandId: 'worktreeNavigator.setSharedFilesSyncMode'
          },
          {
            kind: 'command',
            label: 'Open Shared Files Sync Mode Setting',
            description: 'Search the related setting',
            commandId: 'workbench.action.openSettings',
            commandArgs: ['worktreeNavigator.sharedFilesSyncMode']
          }
        ]
      },
      {
        id: 'shared-file-docs',
        label: 'How shared file sync works',
        description: 'Open the longer explanation',
        detail:
          'Shared files always use the main worktree as the source of truth and store their metadata in the main worktree settings.',
        actions: [
          {
            kind: 'readme',
            label: 'Open README',
            description: 'Read the shared files section'
          }
        ]
      }
    ]
  },
  {
    id: 'local-ignore',
    label: 'Local Ignore',
    description: 'Edit the shared common .git/info/exclude file',
    topics: [
      {
        id: 'open-local-ignore',
        label: 'Edit Local Ignore File',
        description: 'Open .git/info/exclude for the current root',
        detail:
          'This opens the Git common dir exclude file shared across linked worktrees for the matched root.',
        actions: [
          {
            kind: 'command',
            label: 'Run Edit Local Ignore File',
            description: 'Open the shared exclude file',
            commandId: 'worktreeNavigator.openLocalIgnoreFile'
          }
        ]
      },
      {
        id: 'local-ignore-docs',
        label: 'How local ignore works',
        description: 'Open the longer explanation',
        detail:
          'Because linked worktrees share the same Git common dir, ignore rules added there apply across the related worktree set.',
        actions: [
          {
            kind: 'readme',
            label: 'Open README',
            description: 'Read the local ignore section'
          }
        ]
      }
    ]
  },
  {
    id: 'shortcuts',
    label: 'Shortcuts',
    description: 'Reveal commands and shortcut rebinding',
    topics: [
      {
        id: 'shortcut-help',
        label: 'Open Shortcut Help',
        description: 'Review shortcut conflicts or rebind them',
        detail:
          'The shortcut help command opens the global keyboard shortcuts UI filtered to the relevant commands.',
        actions: [
          {
            kind: 'command',
            label: 'Open Shortcut Help',
            description: 'Open Keyboard Shortcuts',
            commandId: 'worktreeNavigator.openShortcutHelp'
          }
        ]
      },
      {
        id: 'reveal-current-root-shortcut',
        label: 'Reveal current root shortcut',
        description: 'Default shortcut: cmd+r / ctrl+r',
        detail:
          'The default shortcut reveals the current root in the Worktrees sidebar and can conflict with existing bindings.',
        actions: [
          {
            kind: 'command',
            label: 'Open Shortcut Help',
            description: 'Inspect or rebind the shortcut',
            commandId: 'worktreeNavigator.openShortcutHelp'
          },
          {
            kind: 'command',
            label: 'Run Reveal Current Root',
            description: 'Try the command directly',
            commandId: 'worktreeNavigator.revealCurrentRoot'
          }
        ]
      }
    ]
  },
  {
    id: 'settings',
    label: 'Settings',
    description: 'Open the extension settings quickly',
    topics: [
      {
        id: 'setting-open-in-new-window',
        label: 'Open in New Window',
        description: 'Default open behavior for roots and worktrees',
        detail:
          'When enabled, opening a root or worktree uses a new window by default instead of reusing the current one.',
        actions: [
          {
            kind: 'command',
            label: 'Open Setting',
            description: 'Search this setting in VS Code',
            commandId: 'workbench.action.openSettings',
            commandArgs: ['worktreeNavigator.openInNewWindow']
          }
        ]
      },
      {
        id: 'setting-double-click-interval',
        label: 'Double Click Interval',
        description: 'Timing threshold for root double-click',
        detail:
          'Controls how quickly two root clicks must occur to count as an open action when double-click is enabled.',
        actions: [
          {
            kind: 'command',
            label: 'Open Setting',
            description: 'Search this setting in VS Code',
            commandId: 'workbench.action.openSettings',
            commandArgs: ['worktreeNavigator.doubleClickIntervalMs']
          }
        ]
      },
      {
        id: 'setting-auto-refresh',
        label: 'Auto Refresh on Window Focus',
        description: 'Refresh when VS Code regains focus',
        detail:
          'Keeps the tree reasonably fresh without requiring manual refresh after switching windows.',
        actions: [
          {
            kind: 'command',
            label: 'Open Setting',
            description: 'Search this setting in VS Code',
            commandId: 'workbench.action.openSettings',
            commandArgs: ['worktreeNavigator.autoRefreshOnWindowFocus']
          }
        ]
      },
      {
        id: 'setting-root-double-click',
        label: 'Enable Root Double Click',
        description: 'Experimental fast open behavior',
        detail:
          'When enabled, a quick second click on a root opens it directly instead of only expanding the tree.',
        actions: [
          {
            kind: 'command',
            label: 'Open Setting',
            description: 'Search this setting in VS Code',
            commandId: 'workbench.action.openSettings',
            commandArgs: ['worktreeNavigator.enableRootDoubleClick']
          }
        ]
      },
      {
        id: 'setting-shared-files',
        label: 'Shared Files',
        description: 'Stored shared file paths',
        detail:
          'This setting stores the registered shared file paths relative to the main worktree.',
        actions: [
          {
            kind: 'command',
            label: 'Open Setting',
            description: 'Search this setting in VS Code',
            commandId: 'workbench.action.openSettings',
            commandArgs: ['worktreeNavigator.sharedFiles']
          }
        ]
      },
      {
        id: 'setting-shared-files-sync-mode',
        label: 'Shared Files Sync Mode',
        description: 'Automatic and manual sync behavior',
        detail:
          'Choose between manual sync, sync on create, sync on create and open, or turning sync off.',
        actions: [
          {
            kind: 'command',
            label: 'Open Setting',
            description: 'Search this setting in VS Code',
            commandId: 'workbench.action.openSettings',
            commandArgs: ['worktreeNavigator.sharedFilesSyncMode']
          }
        ]
      }
    ]
  },
  {
    id: 'docs-reference',
    label: 'Docs & Reference',
    description: 'README and sidebar entry points',
    topics: [
      {
        id: 'open-readme',
        label: 'Open README',
        description: 'Read the full project documentation',
        detail:
          'The README documents the full command list, settings, shared file behavior, and local ignore details.',
        actions: [
          {
            kind: 'readme',
            label: 'Open README',
            description: 'Open the bundled documentation'
          }
        ]
      },
      {
        id: 'focus-sidebar',
        label: 'Open the Worktrees sidebar',
        description: 'Jump back to the extension view',
        detail: 'Use this when you only need to get to the main Projects & Worktrees tree quickly.',
        actions: [
          {
            kind: 'command',
            label: 'Focus Worktrees Sidebar',
            description: 'Open the sidebar view',
            commandId: 'workbench.view.extension.worktreeNavigator'
          }
        ]
      }
    ]
  }
];
