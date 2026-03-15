# VS Code Marketplace 배포 가이드

Worktree Navigator 확장을 Git 태그 기반 GitHub Actions로 배포하는 절차.

## 현재 배포 구조

- PR 생성/업데이트 시 GitHub Actions가 `pnpm lint`, `pnpm compile`, `pnpm format:check`를 자동 실행합니다.
- `v*.*.*` 형식의 Git 태그를 push하면 release workflow가 실행됩니다.
- release workflow는 `package.json.version`과 태그 버전이 일치하는지 확인한 뒤 VS Code Marketplace에 배포합니다.

## 사전 준비

### 1. Marketplace publisher 준비

1. https://marketplace.visualstudio.com/manage 접속
2. **Create publisher** 클릭
3. Publisher ID 생성
4. `package.json`의 `publisher`를 그 ID로 변경

> 현재 `publisher`가 `local`이면 release workflow가 실패하도록 설정되어 있습니다.

### 2. Azure DevOps Personal Access Token (PAT) 발급

1. https://dev.azure.com 접속 후 로그인
2. 우측 상단 사용자 아이콘 > **Personal access tokens**
3. **+ New Token**
4. **Marketplace > Manage** 권한 포함
5. 발급 후 값을 복사

### 3. GitHub Secret 등록

GitHub 저장소의 **Settings > Secrets and variables > Actions** 에서 아래 secret을 등록합니다.

- `VSCE_PAT`: Marketplace 배포용 PAT

## 릴리스 방법

### 1. 버전 업데이트

릴리스 전 `package.json`의 `version`을 먼저 올립니다.

예시:

```json
{
  "version": "0.1.0"
}
```

### 2. 로컬 검증

```bash
pnpm install
pnpm lint
pnpm compile
pnpm format:check
```

필요하면 로컬에서 VSIX도 만들어볼 수 있습니다.

```bash
pnpm dlx @vscode/vsce package
code --install-extension worktree-navigator-0.1.0.vsix
```

### 3. 커밋 후 태그 push

```bash
git add package.json pnpm-lock.yaml
git commit -m "Release v0.1.0"
git tag v0.1.0
git push origin main
git push origin v0.1.0
```

### 4. GitHub Actions 자동 배포

release workflow가 아래 순서로 실행됩니다.

1. 의존성 설치
2. 태그 버전과 `package.json.version` 비교
3. `pnpm lint`
4. `pnpm compile`
5. `pnpm format:check`
6. `vsce publish`

태그와 버전이 다르거나, `publisher`가 아직 `local`이거나, `VSCE_PAT`가 없으면 배포는 실패합니다.

## 배포 후 확인

- GitHub Actions 실행 로그 확인
- Marketplace 반영까지 수 분 정도 걸릴 수 있음
- 확인 URL: `https://marketplace.visualstudio.com/items?itemName=<publisher-id>.worktree-navigator`

## 운영 팁

- branch protection을 사용한다면 PR 필수 체크로 CI workflow를 지정합니다.
- release workflow는 버전을 자동으로 올리지 않습니다. 버전 수정과 태그 생성은 릴리스 전에 직접 해야 합니다.
- 아이콘을 Marketplace에 노출하려면 PNG 아이콘 파일을 추가하고 `package.json`의 `icon` 필드를 설정해야 합니다.
