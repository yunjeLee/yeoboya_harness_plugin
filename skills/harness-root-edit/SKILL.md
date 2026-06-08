---
name: harness-root-edit
description: "이미 생성된 루트 하네스 문서(docs/*.md, CLAUDE.md)를 인자로 받은 대상만 코드 기준으로 수정하고 검증·승인까지 잇는다. /harness-root-edit prd, /harness-root-edit architecture, 루트 문서 수정, 하네스 루트 편집 요청 시 사용한다. 인자 없으면 어떤 문서 수정할지 묻는다."
model: opus
---

# harness-root-edit — 루트 하네스 문서 편집

## 트리거
- `/harness-root-edit {문서명}` — 예: `prd`, `adr`, `architecture`, `conventions`, `testing`, `session`, `ui_guide`, `claude`

## 절차
1. **인자 확인**: 인자가 없으면 → 수정 가능한 문서 목록을 보여주고 "어떤 문서를 수정할까요?" 질문 후 종료/대기.
2. **위임**: 코드 읽기·갱신을 `harness-read-write` 에이전트에 위임한다 (mode=update, 대상=root, 수정 문서 1개, 스키마 경로, 레포 루트). 문서 갱신은 레포 실상 일치를 맞추려면 코드를 읽어야 하므로 위임이 기본이다. 메인 컨텍스트는 격리된다.
3. **검증**: `/harness-verify root` 로 검증 agent 6축 검사를 받는다.
4. **사람 게이트**: 에이전트가 돌려준 수정 diff + 검증 결과를 보여주고 승인/반려. (규칙 변경 = 사람 게이트)

## 원칙
- 전체를 갈아엎지 않고 인자로 받은 대상만 점진 수정한다 (harness-read-write 가 기존 보존·최소 diff 로 갱신).
- 적재 정책(자동 적재 2종 / 조건부 rule)을 깨지 않는다.
