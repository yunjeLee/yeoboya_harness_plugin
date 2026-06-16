# harness-update 설계 스펙

작성일: 2026-06-16

## 1. 목적

개발이 진행되면 코드가 변하고 하네스 문서가 썩는다(decay). 현재는 ① decay
hook(커밋당 알림) ② 사람이 `/harness-root-edit` / `/harness-module-edit`로 한
문서씩 수동 갱신 — 두 경로뿐이라, **전체를 코드와 대조해 일괄 reconcile**하는
주체가 없다. harness-update는 이 빈칸(일괄 화해)을 채운다.

## 2. 정체성 / 책임 경계

- **정체성:** 일괄 화해(batch reconcile) 드라이버 = 기존 워커 2개를 재사용하는
  오케스트레이터.
- **새 워커를 만들지 않는다.** 감지는 `harness-doc-verifier`, 갱신은
  `harness-read-write(mode=update)` 재사용.
- **단일 문서 수동 수정**은 기존 edit 스킬이 계속 담당. harness-update는 배치 —
  책임이 겹치지 않는다.

## 3. 트리거 / 스코프 (확정)

- 트리거: `/harness-update` (수동). cron 없음.
  - 스케줄 무인 적용은 진실원천을 무인 덮어쓰기 → 닫힌 루프 오염이므로 제외.
- 스코프: **변경분만(git diff) 기본 + `--full` 옵션.**
  - `.harness/last-update`(직전 적용 SHA)가 없으면 자동으로 `--full`로 강등.

## 4. 흐름 (harness-module-gen.js 패턴 차용)

```
1. Scope  (결정론적 JS, agent 아님 — 토큰 절감)
   .harness/last-update 읽기 → 없으면 --full
   git diff {SHA}..HEAD → 변경 파일 → 변경 모듈 → 후보 모듈 문서
   구조 파일(settings/build.gradle·manifest·DI) 변경 시
     → 루트 ARCHITECTURE/CONVENTIONS 도 후보 포함
   --full → 전체 문서

2. DetectDrift  [병렬]  →  harness-doc-verifier
   후보 문서만 "레포 실상 일치(⭐)" 중심 6축 검사
   drift 없는 문서는 여기서 탈락 (= "필요한 부분만"의 실현 지점)

3. Update  [병렬]  →  harness-read-write (mode=update)
   drift 문서만 최소 diff 초안. ≤50줄 / {TBD} 규칙 유지

4. Reverify  [병렬]  →  harness-doc-verifier
   갱신본 재검증

5. 통합 diff + 검증 요약 → 단일 사람 게이트 (SKILL.md 담당)
   승인 시에만 .harness/last-update = HEAD SHA 기록
```

워크플로우(harness-update.js)는 1~4를 격리 실행하고 결과만 반환한다. 사람
게이트(5)는 SKILL.md가 담당한다 — harness-module과 동일한 분리.

## 5. 기존 flow 불간섭 검증

| 기존 요소 | 영향 |
|---|---|
| decay hook | 유지. 커밋당 알림 → harness-update가 그 알림들의 일괄 정산 |
| edit 스킬 | 유지. 단일 수동 vs 배치 — 책임 분리 |
| harness-read-write / harness-doc-verifier | 신규 생성 없이 재사용 |
| 사람 게이트 | edit 스킬과 동일 안전 모델 (무인 덮어쓰기 방지) |
| `.harness/` | work 스킬이 이미 .gitignore 추가. last-update 마커 안전 |

## 6. 설계 원칙 정합

- **감지/수정 분리:** 감지(verify) → 수정(read-write) → 재검증 → 사람 게이트.
- **닫힌 루프:** 코드 루프(work/bug-fix)가 만든 변경을 문서 루프가 따라잡아
  진실원천을 코드와 일치 유지.
- **격리 컨텍스트 / 파일 경유 핸드오프 / 최소 diff:** 기존 패턴 그대로.

## 7. 산출물

- `skills/harness-update/SKILL.md`
- `skills/harness-update/script/harness-update.js` (워크플로우)
- (Scope 단계 git 매핑은 워크플로우 내 결정론적 JS)

## 8. 비목표 (YAGNI)

- cron / 무인 자동 적용
- 새 검증/갱신 워커 에이전트
- 단일 문서 인터랙티브 편집 (edit 스킬이 담당)
