---
name: harness-module-edit
description: "이미 생성된 모듈 CLAUDE.md({path}/CLAUDE.md)를 인자로 받은 모듈만 코드 기준으로 갱신하고 검증·승인까지 잇는다. /harness-module-edit {모듈경로}, 모듈 CLAUDE.md 갱신, decay 반영, 모듈 하네스 수정 요청 시 사용한다. 인자 없으면 모듈 목록을 묻는다."
model: opus
---

# harness-module-edit — 모듈 하네스 문서 편집

## 트리거
- `/harness-module-edit {모듈경로}` — 예: `core/core-util`, `feature/feature-home`
- decay 알림 hook 이 유도하는 진입점이기도 하다.

## 절차
1. **인자 확인**: 인자 없으면 → CLAUDE.md 를 가진 leaf 모듈 목록을 보여주고 "어떤 모듈을 수정할까요?" 질문 후 종료/대기.

2. **위임**: 코드 읽기·갱신을 `harness-read-write` 에이전트에 위임한다 (mode=update, 대상=module:{path}, 스키마 경로, 레포 루트). 모듈 편집은 레포 실상 일치를 맞추려면 거의 항상 코드를 읽어야 하므로 위임이 기본이다. 메인 컨텍스트는 격리된다.

3. **검증**: `/harness-verify module:{path}` 로 검증 agent 6축 검사.

4. **사람 게이트**: 에이전트가 돌려준 diff + 검증 결과를 보여주고 승인/반려.

## 원칙
- 인자 모듈만 점진 수정. 다른 모듈 CLAUDE.md 는 건드리지 않는다.
- 스킬은 오케스트레이터, 실제 읽기·갱신은 워커(harness-read-write)가 격리 실행한다.
