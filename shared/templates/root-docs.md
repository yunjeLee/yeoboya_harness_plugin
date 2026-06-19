# harness-root 문서 스키마 (≤50줄 원칙 — 긴 예시 금지, 짧은 스키마)

read & write agent 가 각 문서를 채울 때 따르는 골격. 항목만 제시하고, 내용은 코드 실상으로 채운다.

> 폴더 규칙 — `docs/` 루트 = **자동 적재**(항상 로드), `docs/rules/` = **조건부 로딩**(조건 맞을 때 path 로 Read). 트리거(언제 읽을지)는 항상 CLAUDE.md 안에만 둔다 (자동 로드되는 파일이 CLAUDE.md 뿐이므로).

---

# 자동 적재 (docs/ 루트)

## docs/ARCHITECTURE.md
- 디렉토리 구조
- 패턴: 아키텍처 / 디자인패턴 / UI 시스템
- 데이터 흐름 / 상태관리

## docs/CONVENTIONS.md
- 기본 코드 스타일 / 에러 처리 / 로깅
- claude 작업 스코프 / 커밋 메시지 / push 정책

## docs/SESSION.md  · 짧게 유지
- 세션 시작 시 읽는 것 / 종료 시 검증하는 것
- 진행 추적 파일 `.harness/run-*.md` 규칙: **미완료(남은 완료기준 체크리스트가 있는) run 파일이 있으면 재개 제안** / id `run-{KST날짜-시간-요구slug}` / 완료 기준 확인 규칙
- 자동 적재 대상이므로 **산문 금지, 짧은 규칙 목록**으로만 작성한다.

---

# 조건부 로딩 (docs/rules/)

## docs/rules/PRD.md
- 이 앱이 어떤 앱인지 / 주요 사용자 / 플랫폼 / 출시 상태

## docs/rules/ADR.md
- 사용 중인 핵심 라이브러리와 채택 이유
- 손해(트레이드오프)에도 그 라이브러리를 유지하는 이유

## docs/rules/TESTING.md
- 테스트 레벨 / 네이밍 규칙 / 커버리지 목표 / CI 연동 / 사용 라이브러리
- 통합/E2E 작성 규칙:
  - 경계 동작(cross-module behavior)을 실제로 단언할 것 (test-after 사각지대 방지 가드)
  - 레벨별 실행 환경 (플랫폼 도구는 프로젝트가 채움):
    - 호스트 자동 통합 (예) Android: JVM/Robolectric·in-memory, iOS: XCTest)
    - 기기/시뮬레이터 E2E (예) Android: Espresso/Maestro, iOS: XCUITest/Maestro)
- 검증 명령어 (실행 가능한 명령 — work/bug-fix 루프의 입력원):
  - build / lint / Unit
  - Integration(호스트 자동) — work 자동 루프에 포함
  - E2E(기기/시뮬레이터) — 사람 게이트, 수동 트리거

## docs/rules/UI_GUIDE.md  (선택)
- 색상 / 컴포넌트

## docs/rules/{module}.md  (상위 모듈 계층 규칙 — harness-module 이 생성)
- 역할 / 의존 방향 / 절대 금지 (module-claude 템플릿 참조)

---

## CLAUDE.md
- critical 규칙 (절대 하면 안 되는 것)
- Claude Code 응답 규칙
- **자동 적재 (항상 `@`)**: ARCHITECTURE / CONVENTIONS / SESSION 3종.
- **조건부 로딩 (rule)**: 나머지는 `docs/rules/` 에 두고, 트리거만 아래 블록에 둔다.

```markdown
## 조건부 로딩 (rule)  — 트리거는 항상 여기, 내용은 docs/rules/
- test 디렉토리(**/test/, **/androidTest/, **/*Tests/) 편집 시 → @docs/rules/TESTING.md
- {사용자 지정 경로} 편집 시 → @docs/rules/UI_GUIDE.md     # harness-root 가 실행 시 경로를 물어 채움
- 신규 기능/스펙 작업 시작 시 → @docs/rules/PRD.md
- 의존성 매니페스트(build.gradle.kts, libs.versions.toml, Podfile, Package.swift) 편집 시 → @docs/rules/ADR.md
- {상위 모듈} 접근 시 → @docs/rules/{module}.md           # harness-module 이 존재하는 상위 모듈만 채움
```
