# Worktree Navigator

Git worktree를 VS Code 사이드바에서 관리하는 확장입니다.

English documentation: [README.en.md](./README.en.md)

## 개요

Worktree Navigator는 여러 프로젝트 루트를 등록해 두고, 각 루트 아래의 Git worktree를 한 곳에서 탐색하고 여는 데 초점을 둡니다.
단순한 목록 표시를 넘어서 worktree 생성/삭제, 공유 파일 동기화, local ignore 편집까지 VS Code 안에서 처리할 수 있게 구성되어 있습니다.
회사에서 `Claude Code`와 `Codex`를 함께 쓰면서 Git worktree 기반으로 작업할 일이 많았는데, 기존 VS Code 확장들이 원하는 흐름에 잘 맞지 않아 이 확장을 직접 만들었습니다.

## 주요 기능

- 프로젝트 루트 등록 및 목록 관리
- 등록된 루트 아래의 Git 저장소 자동 탐색
- main, branch, detached, locked, prunable 상태를 트리 아이템으로 구분
- 프로젝트 루트와 worktree를 현재 창 또는 새 창에서 열기
- 프로젝트 루트에서 새 worktree 생성
- worktree 제거 시 연결된 branch 삭제까지 선택 가능
- 창 포커스 복귀 시 자동 새로고침
- 루트 더블클릭으로 빠르게 열기
- 단축키로 현재 루트 / 현재 worktree를 사이드바에서 선택 및 포커스
- main worktree 기준 공유 파일 등록 및 다른 worktree로 동기화
- linked worktree가 공유하는 common `.git/info/exclude` 파일 편집

## 사이드바에서 할 수 있는 작업

사이드바 컨테이너 이름은 `Worktrees`이며, 뷰 이름은 `Projects & Worktrees`입니다.

- 루트 추가
- 루트 새로고침
- 저장된 루트 목록 직접 편집
- 프로젝트 루트 열기 / 새 창에서 열기
- worktree 열기 / 새 창에서 열기
- worktree 생성 및 제거
- 공유 파일 추가 / 제거 / 수동 동기화
- 공유 파일 동기화 모드 변경
- local ignore 파일 열기

## 명령어

| 명령어                                                   | 설명                                                              |
| -------------------------------------------------------- | ----------------------------------------------------------------- |
| `Worktree Navigator: Add Project Root`                   | 프로젝트 루트를 등록합니다.                                       |
| `Worktree Navigator: Refresh`                            | 트리 데이터를 새로고침합니다.                                     |
| `Worktree Navigator: Edit Saved Roots`                   | 저장된 루트 목록 파일을 직접 엽니다.                              |
| `Worktree Navigator: Remove Project Root`                | 등록된 프로젝트 루트를 제거합니다.                                |
| `Worktree Navigator: Open Project Root`                  | 프로젝트 루트를 현재 창에서 엽니다.                               |
| `Worktree Navigator: Open Project Root in New Window`    | 프로젝트 루트를 새 창에서 엽니다.                                 |
| `Worktree Navigator: Open Worktree`                      | 선택한 worktree를 현재 창에서 엽니다.                             |
| `Worktree Navigator: Open Worktree in New Window`        | 선택한 worktree를 새 창에서 엽니다.                               |
| `Worktree Navigator: Create Worktree`                    | 새 worktree를 생성합니다.                                         |
| `Worktree Navigator: Remove Worktree`                    | worktree를 제거하고 필요하면 branch 삭제도 진행합니다.            |
| `Worktree Navigator: Add Shared File`                    | main worktree 기준 공유 파일을 등록합니다.                        |
| `Worktree Navigator: Remove Shared File`                 | 등록된 공유 파일을 제거합니다.                                    |
| `Worktree Navigator: Sync Shared Files`                  | 공유 파일을 수동 동기화합니다.                                    |
| `Worktree Navigator: Set Shared Files Sync Mode`         | 공유 파일 동기화 모드를 변경합니다.                               |
| `Worktree Navigator: Edit Local Ignore File`             | main/common `.git/info/exclude` 파일을 엽니다.                    |
| `Worktree Navigator: Reveal Current Root in Sidebar`     | 현재 워크스페이스가 속한 프로젝트 루트를 사이드바에서 선택합니다. |
| `Worktree Navigator: Reveal Current Worktree in Sidebar` | 현재 워크스페이스에 해당하는 worktree를 사이드바에서 선택합니다.  |
| `Worktree Navigator: Open Shortcut Help`                 | Keyboard Shortcuts 편집기를 열어 단축키 충돌/재설정을 확인합니다. |

## 기본 단축키

| 동작           | macOS   | Windows / Linux |
| -------------- | ------- | --------------- |
| 현재 루트 선택 | `cmd+r` | `ctrl+r`        |

- 단축키를 누르면 `Worktrees` 사이드바가 열리고 해당 root/worktree 항목이 실제 선택 상태로 표시됩니다.
- `현재 루트 선택` 단축키는 한 번 누르면 현재 root를 펼치고, 현재 워크스페이스와 매치되는 root가 없으면 첫 번째 등록 root를 펼칩니다. 같은 워크스페이스에서 짧은 시간 안에 다시 누르면 이전에 펼친 root를 접은 뒤 다음 root로 내려가면서 펼칩니다.
- root나 worktree가 선택된 상태에서 `Enter`를 누르면 해당 프로젝트 루트나 worktree를 바로 엽니다.
- 등록된 root가 전혀 없을 때만 안내 메시지를 보여주고, 바로 Keyboard Shortcuts 화면으로 이동할 수 있습니다.
- `cmd+r`, `ctrl+r`는 기존 VS Code/확장 단축키와 충돌할 수 있으니, 필요하면 `Worktree Navigator: Open Shortcut Help` 명령으로 바로 재바인딩할 수 있습니다.

## 설정

| 설정                                         | 기본값   | 설명                                                                                      |
| -------------------------------------------- | -------- | ----------------------------------------------------------------------------------------- |
| `worktreeNavigator.openInNewWindow`          | `false`  | 프로젝트 루트나 worktree를 열 때 현재 창 대신 새 창을 기본으로 사용합니다.                |
| `worktreeNavigator.doubleClickIntervalMs`    | `400`    | 두 번의 클릭을 더블클릭으로 간주하는 최대 간격(ms)입니다.                                 |
| `worktreeNavigator.autoRefreshOnWindowFocus` | `true`   | VS Code 창이 다시 포커스를 얻을 때 트리를 새로고침합니다.                                 |
| `worktreeNavigator.enableRootDoubleClick`    | `true`   | 루트 아이템을 빠르게 두 번 클릭했을 때 바로 여는 실험적 동작을 켭니다.                    |
| `worktreeNavigator.sharedFiles`              | `[]`     | main worktree 기준 상대 경로로 관리되는 공유 파일 목록입니다.                             |
| `worktreeNavigator.sharedFilesSyncMode`      | `manual` | 공유 파일 동기화 모드입니다. `manual`, `onCreate`, `onCreateAndOpen`, `off`를 지원합니다. |

## 공유 파일 동기화

공유 파일은 main worktree를 기준으로 관리됩니다.

- 등록 정보는 main worktree의 `.vscode/settings.json`에 저장됩니다.
- `manual`: 명령을 직접 실행할 때만 동기화합니다.
- `onCreate`: 새 worktree를 만들 때 자동 동기화합니다.
- `onCreateAndOpen`: 생성 시와 열기 시 모두 자동 동기화합니다.
- `off`: 자동/수동 동기화를 모두 끕니다.

예를 들어 `.env`, `.env.local`, `.npmrc`, 팀 로컬 설정 파일처럼 브랜치마다 반복 복사하기 번거로운 파일을 main worktree에서 기준본으로 두고 퍼뜨릴 수 있습니다.

## Local Ignore

`Worktree Navigator: Edit Local Ignore File` 명령은 현재 root가 공유하는 Git common dir의 `.git/info/exclude`를 엽니다.
linked worktree들이 같은 common dir를 공유하므로, 여기서 관리한 ignore 규칙은 해당 worktree 집합 전체에 적용됩니다.

## 저장 위치와 동작 참고

- 등록된 프로젝트 루트 목록은 VS Code global storage 아래의 `roots.json`에 저장됩니다.
- 현재 워크스페이스가 Git 저장소라면 창 제목을 `parent/current (branch)` 형식으로 업데이트합니다.
- Git 명령은 시스템 `PATH`에서 실행 가능한 `git`을 사용합니다.
- `git worktree list --porcelain -z` 출력을 기준으로 worktree를 파싱합니다.

## 개발

```bash
pnpm install
pnpm compile
pnpm lint
pnpm format:check
```

- `F5`로 Extension Development Host를 실행할 수 있습니다.
- 빌드 결과물은 `out/`에 생성됩니다.
- PR이 열리면 GitHub Actions가 `pnpm lint`, `pnpm compile`, `pnpm format:check`를 자동으로 실행합니다.
- Marketplace 배포와 릴리스 절차는 [PUBLISH.md](./PUBLISH.md)를 참고하세요.

## 라이선스

MIT
