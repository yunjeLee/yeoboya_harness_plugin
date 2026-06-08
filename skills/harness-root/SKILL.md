---
name: harness-root
description: "프로젝트 루트의 하네스 문서 7종(+선택 UI_GUIDE)과 CLAUDE.md 를 read & write agent 로 초안 생성하고 검증·승인까지 잇는다. /harness-root, 하네스 루트 생성, 루트 문서 작성, harness root 만들기 요청 시 사용한다. 누락된 문서만 채운다."
model: opus
---

# harness-root — 루트 하네스 문서 생성/보완

read & write agent 가 코드를 읽어 **초안을 자동 생성** → 검증 agent 6축 1차 검증 → 사람은 diff 로 승인/반려만. (빈 문서를 사람이 채우지 않는다.)

## 트리거
- `/harness-root` — 프로젝트 루트에서 실행

## 필수 7종 + 선택 1종 (폴더 배치)
- **자동 적재** `docs/`: ARCHITECTURE, CONVENTIONS, SESSION
- **조건부 로딩** `docs/rules/`: PRD, ADR, TESTING (+ UI_GUIDE 선택)
- **루트**: CLAUDE.md (자동 로드 주체 — 트리거를 담는 그릇)
- 스키마: `@${CLAUDE_PLUGIN_ROOT}/shared/templates/root-docs.md`

## 절차
1. **존재 점검**: 7종이 모두 있으면 → "수정은 /harness-root-edit 를 쓰라" 안내 후 종료.
2. 일부만 있으면 → 기존 문서는 두고 **없는 문서만** 대상으로 잡는다.
3. **초안 생성**: `harness-read-write` 에이전트에 (mode=create, 대상=root, 누락 문서 목록, 스키마 경로, 레포 루트)를 전달해 위임. 산출물은 `docs/*.md` + `docs/rules/*.md` + `CLAUDE.md` 로 파일 저장.
4. **적재 정책**: CLAUDE.md 에 아래가 기재되었는지 확인.
   - **자동 적재 (항상 `@`)**: ARCHITECTURE / CONVENTIONS / SESSION 3종. SESSION 은 자동 적재 대상이므로 **짧은 규칙 목록**으로만 유지.
   - **조건부 로딩 (rule)**: TESTING(test 편집), UI_GUIDE(지정 경로), PRD(신규 기능 시작), ADR(의존성 매니페스트 편집), 상위 모듈 rule.
5. **UI_GUIDE 트리거 질문**: UI_GUIDE 를 생성하는 경우, **"UI_GUIDE 를 어떤 모듈/경로 접근 시 읽을까요? (예: feature/, core/core_designsystem/)"** 를 사람에게 물어 답을 조건부 로딩 규칙의 `{사용자 지정 경로}` 에 박는다.
6. **검증**: `/harness-verify root` 로 검증 agent 6축 검사를 받는다.
7. **사람 게이트**: 검증 결과 + 초안 diff 를 사람에게 보여주고 승인/반려. (하네스=규칙 변경은 사람 게이트)

## 원칙
- 한 스킬 = 한 파일 자체완결, 큰 참조는 스키마 1개뿐.
- read & write agent 와 검증 agent 는 파일을 경유해 핸드오프한다.
