---
name: harness-update
description: "코드 변화로 썩은 하네스 문서를 변경분(git diff) 기준으로 일괄 reconcile 한다. 변경 모듈/문서만 스코핑 → 워크플로우로 drift 감지·갱신·재검증 → 사람 게이트. /harness-update, /harness-update --full, 하네스 문서 일괄 갱신, 문서 decay 정리, 주기적 하네스 동기화 요청 시 사용한다. 단일 문서 수동 수정은 /harness-root-edit·/harness-module-edit, 새로 만들 땐 /harness-root·/harness-module. (이 스킬 호출 = 워크플로우 실행 동의)"
model: opus
---

# harness-update — 하네스 문서 일괄 화해(batch reconcile)

decay hook 은 커밋당 알림만 주고, edit 스킬은 한 문서씩 수동으로 고친다. 이 스킬은 그 사이 빈칸 — **변경분 전체를 코드와 한 번에 대조해 썩은 문서만 골라 갱신**하는 일괄 정산 — 을 채운다.

스코핑(git 매핑)은 결정론적이라 스크립트가, 감지·갱신·재검증은 격리 워커가 워크플로우 안에서 처리한다. 스킬은 진입점·git 스코핑·사람 게이트만 책임진다 — N개 문서의 코드 읽기가 메인 컨텍스트에 쌓이지 않게 한다.

## 트리거
- `/harness-update` — 마지막 갱신 이후 **변경분만** reconcile (기본, 권장)
- `/harness-update --full` — 모든 하네스 문서를 전체 스윕 (대규모 리팩터 후 등)

## 선행 조건
- 하네스 문서가 하나도 없으면 갱신할 대상이 없다 → `/harness-root`(+`/harness-module`) 안내 후 종료.

## 절차
1. **스코핑** (Bash, 결정론적): 스크립트를 실행해 갱신 후보 문서를 고른다.
   ```
   bash ${CLAUDE_PLUGIN_ROOT}/skills/harness-update/script/harness-update-scope.sh <레포 루트> [--full]
   ```
   - 출력은 탭 구분 라인: `MODE`, `BASE`(직전 적용 SHA), `DOC<TAB>kind<TAB>path`.
   - `.harness/last-update`(직전 적용 SHA)가 없으면 스크립트가 자동으로 `full` 로 강등한다.
   - `DOC` 라인이 하나도 없으면(=변경분 없음) → "갱신할 변경분 없음" 안내 후 종료.

2. **워크플로우 실행**: `DOC` 라인들을 `candidates` 배열(`[{path, kind}]`)로 묶어 `Workflow` 를 호출한다.
   - `scriptPath: ${CLAUDE_PLUGIN_ROOT}/skills/harness-update/script/harness-update.js`
   - `args: { repoRoot: <레포 루트>, candidates: <위 배열>, moduleSchema: "${CLAUDE_PLUGIN_ROOT}/shared/templates/module-claude.md", rootSchema: "${CLAUDE_PLUGIN_ROOT}/shared/templates/root-docs.md" }`
   - 워크플로우가 **[후보 6축 검증으로 drift 감지 → drift 문서만 최소 diff 갱신 → 재검증]** 을 격리 실행하고 `{ scanned, updated:[{path,summary,tbd,reverify}], clean, blocked:[path...] }` 를 반환한다.
   - 갱신본은 워커가 **파일로 Edit** 한다 (핸드오프는 파일 경유).
   - drift 0건이면 `updated` 가 비어 온다 → 그대로 사람에게 "변경 불필요" 보고 후 5번(마커 기록)으로.

3. **사람 게이트**: 다음을 사람에게 보여주고 승인/반려.
   - 갱신된 문서별 `git diff` + 변경 요약(`summary`) + 재검증 verdict.
   - 손대지 않은 문서(`clean`)와 `{TBD}` 로 남은 항목.
   - `blocked`(갱신 후에도 verdict=block)는 → `/harness-module-edit {path}` 또는 `/harness-root-edit {문서}` 로 사람이 마무리하도록 연결.

4. **반려 시**: 갱신 diff 를 되돌리거나 그대로 두고 종료. **마커는 기록하지 않는다** — 다음 실행이 같은 변경분을 다시 감지하도록.

5. **승인 시 — 마커 기록**: 다음 실행의 변경분 기준점을 갱신한다.
   - `.harness/` 가 대상 프로젝트 `.gitignore` 에 없으면 한 줄 추가(work 스킬과 동일한 가드).
   - `git rev-parse HEAD` 결과를 `.harness/last-update` 에 기록한다. (이 SHA 이후 변경분만 다음 reconcile 대상이 된다.)

## 원칙
- **감지/수정 분리**: 검증 워커가 drift 를 진단하고, 갱신 워커가 고친다. 멀쩡한 문서는 건드리지 않는다("필요한 부분만").
- **무인 덮어쓰기 금지**: 하네스 문서는 work/bug-fix 가 따르는 진실원천이다. 적용·마커 기록은 반드시 사람 게이트 뒤에 둔다.
- **책임 경계**: 이 스킬은 배치 드라이버. 단일 문서 수동 수정은 edit 스킬, 신규 생성은 root/module 스킬, 품질 진단만 필요하면 `/harness-verify`.
- 스킬=진입점·스코핑·게이트, 실제 읽기·갱신·검증은 워크플로우 안의 워커(harness-read-write / harness-doc-verifier)가 격리 실행. 핸드오프는 파일 경유.
