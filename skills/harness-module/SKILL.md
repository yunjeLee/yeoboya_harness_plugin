---
name: harness-module
description: "leaf 모듈별 CLAUDE.md(≤50줄)와 docs/MODULE_MAP.md 인덱스를 read & write agent 로 병렬 초안 생성하고 검증·승인까지 잇는다. /harness-module, 모듈 하네스 생성, 모듈 CLAUDE.md 작성, 모듈 맵 만들기 요청 시 사용한다. 루트 7종이 있어야 실행 가능."
model: opus
---

# harness-module — 모듈 하네스 문서 생성/보완

## 트리거
- `/harness-module` — 프로젝트 루트에서 실행

## 선행 조건
- 루트 하네스 7종이 모두 있어야 한다. 없으면 → `/harness-root` 안내 후 종료.

## 절차
1. **모듈 분류**: 멀티모듈(app / core / data / domain / feature 가 일반적)을 스캔해 **상위 묶음 모듈**과 코드가 실제 있는 **leaf 모듈**(core-resource, core-util, feature-xxx 등)로 구분한다. 어떤 상위 모듈이 존재하는지 먼저 확인한다.
   - 상위 묶음 모듈: CLAUDE.md 를 만들지 않는다 (곧 decay). 대신 **상위 모듈별 rule 파일** `docs/rules/{module}.md` 로 커버한다 (존재하는 상위 모듈만).
   - leaf 모듈: CLAUDE.md 생성 대상.
2. **존재 점검**: 이미 CLAUDE.md(leaf) / rule 파일(상위)이 있으면 그대로 두고 **없는 것만** 대상으로 잡는다.
3. **병렬 초안 생성 (leaf)**: leaf 모듈마다 `harness-read-write` 에이전트를 병렬로 위임(mode=create). 각 에이전트가 서로 다른 모듈 CLAUDE.md 를 쓰므로 충돌 없음. 스키마: `@${CLAUDE_PLUGIN_ROOT}/shared/templates/module-claude.md` (≤50줄).
4. **상위 모듈 rule 생성**: 존재하는 상위 모듈마다 `docs/rules/{module}.md` 를 생성한다. 내용 = **계층 경계 + 의존성 방향 + 절대 금지** (스키마는 같은 템플릿 파일의 "상위 모듈 rule" 섹션 참조).
5. **인덱스 + 적재 규칙**: `docs/MODULE_MAP.md` 를 생성/갱신하고, 루트 `CLAUDE.md` 의 조건부 로딩 블록에 **각 상위 모듈 접근 시 → @docs/rules/{module}.md** 한 줄씩 추가한다.
6. **검증**: `/harness-verify module` 로 검증 agent 6축 검사.
7. **사람 게이트**: diff + 검증 결과 승인/반려.

## 원칙
- leaf CLAUDE.md 는 50줄 이내. 역할/금지/의존성/암묵규칙만.
- 상위 모듈 rule 은 계층 경계·의존성 방향 중심으로 짧게.
- 병렬 위임으로 비용·시간 절감, 핸드오프는 파일 경유.
