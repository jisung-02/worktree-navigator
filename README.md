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

### 설정

| 설정 | 기본값 | 설명 |
|------|--------|------|
| `worktreeNavigator.openInNewWindow` | `false` | 항상 새 창에서 열기 |
| `worktreeNavigator.doubleClickIntervalMs` | `400` | 더블클릭 인식 간격 (ms) |
| `worktreeNavigator.autoRefreshOnWindowFocus` | `true` | 포커스 시 자동 새로고침 |
| `worktreeNavigator.enableRootDoubleClick` | `true` | 루트 더블클릭으로 열기 활성화 |

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

### Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `worktreeNavigator.openInNewWindow` | `false` | Always open in a new window |
| `worktreeNavigator.doubleClickIntervalMs` | `400` | Double-click detection interval (ms) |
| `worktreeNavigator.autoRefreshOnWindowFocus` | `true` | Auto-refresh on window focus |
| `worktreeNavigator.enableRootDoubleClick` | `true` | Enable double-click to open root |

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

---

## License

MIT
