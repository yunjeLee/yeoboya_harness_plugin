---
name: harness-verify
description: "harness-root / harness-module 문서를 6축 기준으로 검증 agent에 위임하고, 수정 제안과 '수정할거냐' 게이트를 제공한다. /harness-verify root, /harness-verify module, 하네스 검증, 문서 검증, 6축 점검 요청 시 사용한다. root/module 공용."
model: opus
---

# harness-verify — 하네스 문서 검증 (root / module 공용)

## 트리거
- `/harness-verify root` — 루트 문서 검증
- `/harness-verify module` — 모듈 CLAUDE.md 검증
- `/harness-verify module:{path}` — 특정 모듈만

## 절차
1. **대상 결정**: 인자(root / module / module:{path})로 검증 문서 경로를 모은다. 인자 없으면 무엇을 검증할지 묻는다.
2. **위임**: `harness-doc-verifier` 에이전트에 (대상, 문서 경로 목록, 레포 루트)를 전달해 6축 검증.
3. **결과 제시**: 축별 문제 + 구체적 수정 문안 + 심각도(block/warn/nit)를 보여준다.
4. **게이트**: "이대로 수정할까요?" 를 묻는다. **수정 여부 선택은 사람이.** 자동 수정하지 않는다.
   - 수정 동의 시 → harness-root-edit / harness-module-edit 로 연결.

## 검증 6축 (agent 기준)
모호성 · 일관성 · 완전성 · 참조 무결성 · **레포 실상 일치** ⭐ · 압축도

## 원칙
- 검증과 수정을 분리한다. 검증 agent 는 진단만, 수정은 사람 게이트 후 edit 스킬.
