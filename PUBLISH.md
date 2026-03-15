# VS Code Marketplace 배포 가이드

Worktree Navigator 확장을 VS Code Marketplace에 배포하는 전체 과정.

---

## 사전 준비

### 1. 도구 설치

```bash
npm install -g @vscode/vsce
```

### 2. Azure DevOps Personal Access Token (PAT) 발급

1. https://dev.azure.com 접속 후 로그인 (Microsoft 계정)
2. 오른쪽 상단 사용자 아이콘 > **Personal access tokens** 클릭
3. **+ New Token** 클릭
4. 설정:
   - **Name**: `vsce` (아무거나)
   - **Organization**: `All accessible organizations` 선택
   - **Expiration**: 원하는 기간 (최대 1년)
   - **Scopes**: 하단의 **Custom defined** 선택 후 → **Marketplace** > **Manage** 체크
5. **Create** 클릭 → **토큰 복사해서 안전한 곳에 저장** (다시 볼 수 없음)

### 3. Publisher 등록

1. https://marketplace.visualstudio.com/manage 접속
2. **Create publisher** 클릭
3. 입력:
   - **ID**: 고유 식별자 (예: `chaejiseong`) — `package.json`의 `publisher`와 일치해야 함
   - **Display Name**: 표시 이름
4. 생성 완료

---

## package.json 수정

배포 전에 아래 필드들을 확인/수정:

```jsonc
{
  // publisher ID를 Marketplace에 등록한 것과 일치시킴
  "publisher": "chaejiseong",

  // 선택사항이지만 강력 권장
  "repository": {
    "type": "git",
    "url": "https://github.com/<user>/worktree-navigator"
  },
  "license": "MIT",
  "icon": "media/icon.png" // 128x128 이상 PNG 파일 필요
}
```

> **주의**: `icon`은 PNG만 가능 (SVG 불가). 128x128px 이상 권장.
> 현재 `media/worktree.svg`가 있으므로, PNG로 변환하거나 별도 PNG 아이콘을 준비.

---

## 빌드 및 패키징

```bash
# 1. 의존성 설치
pnpm install

# 2. TypeScript 컴파일
pnpm compile

# 3. VSIX 패키지 생성 (로컬 테스트용)
vsce package
# → worktree-navigator-0.0.1.vsix 생성됨

# 4. 로컬에서 먼저 테스트
code --install-extension worktree-navigator-0.0.1.vsix
```

---

## 배포

### 방법 A: CLI로 배포 (추천)

```bash
# 1. 로그인 (PAT 입력 프롬프트 나옴)
vsce login <publisher-id>

# 2. 배포
vsce publish
```

### 방법 B: 버전 올리면서 배포

```bash
# patch: 0.0.1 → 0.0.2
vsce publish patch

# minor: 0.0.2 → 0.1.0
vsce publish minor

# major: 0.1.0 → 1.0.0
vsce publish major
```

### 방법 C: VSIX 파일 직접 업로드

1. `vsce package`로 `.vsix` 파일 생성
2. https://marketplace.visualstudio.com/manage 접속
3. 확장 선택 > **Update** > `.vsix` 파일 업로드

---

## 배포 후 확인

- 배포 후 **5~10분** 정도 걸림
- 확인: `https://marketplace.visualstudio.com/items?itemName=<publisher-id>.worktree-navigator`
- VS Code에서 확장 탭 검색으로도 확인 가능

---

## 업데이트 배포

```bash
# 버전 올리고 배포 (한 줄)
vsce publish patch
```

`package.json`의 `version`이 자동으로 올라가고 Marketplace에 반영됨.

---

## 체크리스트

- [ ] Azure DevOps PAT 발급
- [ ] Marketplace publisher 등록
- [ ] `package.json`의 `publisher` 필드 수정
- [ ] PNG 아이콘 준비 (128x128+)
- [ ] `repository`, `license` 필드 추가
- [ ] `pnpm compile` 성공 확인
- [ ] `vsce package` 성공 확인
- [ ] 로컬 VSIX 설치 테스트
- [ ] `vsce publish` 실행
