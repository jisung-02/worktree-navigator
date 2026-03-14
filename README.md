# Worktree Navigator

> **[한국어](#한국어)** | **[English](#english)**

---

## 한국어

Git worktree를 사이드바에서 한눈에 관리하는 VS Code 확장입니다.

### 주요 기능

- **프로젝트 루트 등록** — 여러 프로젝트를 한 곳에서 관리
- **Worktree 자동 탐색** — 등록된 루트 아래의 Git worktree를 자동으로 탐색하고 표시
- **상태별 아이콘** — main, branch, detached, locked, prunable 등 상태에 따라 색상과 아이콘이 구분됨
- **원클릭 이동** — worktree를 클릭하면 바로 해당 폴더로 이동
- **더블클릭 열기** — 프로젝트 루트를 더블클릭하면 해당 폴더를 VS Code에서 열기
- **자동 새로고침** — 윈도우 포커스 시 변경사항을 백그라운드에서 감지하여 반영
- **하위 디렉토리 자동 탐색** — 등록된 경로가 git repo가 아니어도 하위에서 git repo를 자동으로 찾음
- **공유 파일 동기화** — main worktree의 `.env` 같은 파일을 다른 worktree에 자동/수동으로 복사
- **로컬 ignore 편집** — main/common `.git/info/exclude`를 바로 열어서 linked worktree 공통 ignore를 수정

### 명령어

| 명령어 | 설명 |
|--------|------|
| `Worktree Navigator: Add Project Root` | 프로젝트 루트 추가 |
| `Worktree Navigator: Refresh` | 트리 새로고침 |
| `Worktree Navigator: Edit Saved Roots` | 저장된 루트 목록 편집 |
| `Worktree Navigator: Remove Project Root` | 프로젝트 루트 제거 |
| `Worktree Navigator: Open Project Root` | 프로젝트 루트 열기 |
| `Worktree Navigator: Open Worktree` | Worktree 열기 |
| `Worktree Navigator: Open in New Window` | 새 창에서 열기 |
| `Worktree Navigator: Add Shared File` | 어떤 worktree에서든 파일 선택기로 main worktree 기준 공유 파일 등록 |
| `Worktree Navigator: Remove Shared File` | 공유 파일 등록 해제 |
| `Worktree Navigator: Sync Shared Files` | 공유 파일 수동 동기화 |
| `Worktree Navigator: Set Shared Files Sync Mode` | `manual / onCreate / onCreateAndOpen / off` 모드 변경 |
| `Worktree Navigator: Edit Local Ignore File` | 현재 root가 공유하는 main/common `.git/info/exclude` 파일 열기 |

### 설정

| 설정 | 기본값 | 설명 |
|------|--------|------|
| `worktreeNavigator.openInNewWindow` | `false` | 항상 새 창에서 열기 |
| `worktreeNavigator.doubleClickIntervalMs` | `400` | 더블클릭 인식 간격 (ms) |
| `worktreeNavigator.autoRefreshOnWindowFocus` | `true` | 포커스 시 자동 새로고침 |
| `worktreeNavigator.enableRootDoubleClick` | `true` | 루트 더블클릭으로 열기 활성화 |
| `worktreeNavigator.sharedFiles` | `[]` | main worktree 기준 상대경로 공유 파일 목록 |
| `worktreeNavigator.sharedFilesSyncMode` | `manual` | 공유 파일 동기화 모드 (`manual` / `onCreate` / `onCreateAndOpen` / `off`) |

### 개발

```bash
pnpm install
pnpm compile
# F5로 Extension Development Host 실행
```

---

## English

A VS Code extension to manage Git worktrees from a dedicated sidebar.

### Features

- **Register project roots** — manage multiple projects in one place
- **Auto-discover worktrees** — automatically finds and displays Git worktrees under registered roots
- **Status-aware icons** — distinct colors and icons for main, branch, detached, locked, and prunable states
- **One-click navigation** — click a worktree to open it instantly
- **Double-click to open** — double-click a project root to open it in VS Code
- **Background refresh** — detects changes on window focus and updates only when needed
- **Sub-directory discovery** — finds git repos in child directories even if the registered path itself is not a git repository
- **Shared file sync** — copy files like `.env` from the main worktree into other worktrees
- **Local ignore editing** — open the shared main/common `.git/info/exclude` and edit linked-worktree ignores directly

### Commands

| Command | Description |
|---------|-------------|
| `Worktree Navigator: Add Project Root` | Register a project root |
| `Worktree Navigator: Refresh` | Refresh the tree |
| `Worktree Navigator: Edit Saved Roots` | Edit the saved roots list |
| `Worktree Navigator: Remove Project Root` | Remove a project root |
| `Worktree Navigator: Open Project Root` | Open a project root |
| `Worktree Navigator: Open Worktree` | Open a worktree |
| `Worktree Navigator: Open in New Window` | Open in a new window |
| `Worktree Navigator: Add Shared File` | Register shared files from the main worktree with a file picker from any worktree |
| `Worktree Navigator: Remove Shared File` | Unregister a shared file |
| `Worktree Navigator: Sync Shared Files` | Run a manual shared-file sync |
| `Worktree Navigator: Set Shared Files Sync Mode` | Change the shared-file sync mode (`manual / onCreate / onCreateAndOpen / off`) |
| `Worktree Navigator: Edit Local Ignore File` | Open the shared main/common `.git/info/exclude` file for the current root |

### Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `worktreeNavigator.openInNewWindow` | `false` | Always open in a new window |
| `worktreeNavigator.doubleClickIntervalMs` | `400` | Double-click detection interval (ms) |
| `worktreeNavigator.autoRefreshOnWindowFocus` | `true` | Auto-refresh on window focus |
| `worktreeNavigator.enableRootDoubleClick` | `true` | Enable double-click to open root |
| `worktreeNavigator.sharedFiles` | `[]` | Shared file paths relative to the main worktree |
| `worktreeNavigator.sharedFilesSyncMode` | `manual` | Shared-file sync mode (`manual`, `onCreate`, `onCreateAndOpen`, or `off`) |

### Development

```bash
pnpm install
pnpm compile
# Press F5 to launch Extension Development Host
```

### Notes

- Requires Git available on the system `PATH`.
- Worktree parsing uses the stable `git worktree list --porcelain -z` format.
- Registered roots are stored in `roots.json` under VS Code's global storage.
- Shared file settings are stored in the **main worktree's** `.vscode/settings.json`, but you can manage them from any worktree.
- `manual` is the default. Run **Worktree Navigator: Sync Shared Files** (or the sidebar context action) when you want to copy the registered files into a worktree.
- Repo-local ignore patterns live in the Git **common dir** at `.git/info/exclude`, so one edit applies across linked worktrees.

---

## License

MIT
