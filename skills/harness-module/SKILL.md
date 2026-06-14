---
name: harness-module
description: "leaf 모듈별 CLAUDE.md(≤50줄)와 docs/MODULE_MAP.md 인덱스를 워크플로우로 병렬 생성·6축 검증하고 사람 게이트까지 잇는다. /harness-module, 모듈 하네스 생성, 모듈 CLAUDE.md 작성, 모듈 맵 만들기 요청 시 사용한다. 루트 7종이 있어야 실행 가능. (이 스킬 호출 = 워크플로우 실행 동의)"
model: opus
---

# harness-module — 모듈 하네스 문서 생성/보완

분류·병렬 작성·검증·집계는 **워크플로우(`script/harness-module-gen.js`)가 격리 실행**한다. 스킬은 진입점과 사람 게이트만 책임진다 — 모듈 N개의 코드 읽기·초안이 메인 컨텍스트에 쌓이지 않게 한다.

## 트리거
- `/harness-module` — 프로젝트 루트에서 실행

## 선행 조건
- 루트 하네스 7종이 모두 있어야 한다. 없으면 → `/harness-root` 안내 후 종료.

## 절차
1. **선행 조건 확인**: 루트 7종 존재를 확인한다. 없으면 `/harness-root` 안내 후 종료.

2. **워크플로우 실행**: `Workflow` 를 호출한다.
   - `scriptPath: ${CLAUDE_PLUGIN_ROOT}/skills/harness-module/script/harness-module-gen.js`
   - `args: { repoRoot: <레포 루트>, moduleSchema: "${CLAUDE_PLUGIN_ROOT}/shared/templates/module-claude.md", ruleSchema: "${CLAUDE_PLUGIN_ROOT}/shared/templates/module-claude.md" }`
   - 워크플로우가 **[분류·존재점검 → 없는 leaf write‖verify 파이프라인 → 없는 상위 rule fan-out → MODULE_MAP/루트 CLAUDE.md 단일 집계 → 전체 모듈 일관성 검증(`/harness-verify module` 등가)]** 를 수행하고, `{ leaf:[{path,tbd,verdict,...}], upper:[...], crossModule:{verdict,findings}, blocked:[path...] }` 를 반환한다.
   - 산출물(`{module}/CLAUDE.md`, `docs/rules/{module}.md`, `docs/MODULE_MAP.md`)은 워커가 **파일로 Write** 한다 (핸드오프는 파일 경유).

3. **사람 게이트**: 반환된 모듈별 결과(작성 경로 / `{TBD}` 항목 / 6축 verdict)와 **모듈 간 일관성 결과(`crossModule`)**, git diff 를 사람에게 보여주고 승인/반려.
   - `blocked` 에 든 모듈(모듈별 verdict=block **또는** 일관성 충돌)만 → `/harness-module-edit {path}` 로 연결.

## 원칙
- leaf CLAUDE.md 는 50줄 이내. 역할/금지/의존성/암묵규칙만.
- 상위 모듈 rule 은 계층 경계·의존성 방향 중심으로 짧게.
- 스킬=진입점·게이트, 실제 읽기·작성·검증은 워크플로우 안의 워커(harness-read-write / harness-doc-verifier)가 격리 실행. 핸드오프는 파일 경유.
