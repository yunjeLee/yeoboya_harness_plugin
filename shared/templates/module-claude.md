# harness-module CLAUDE.md 스키마 (≤50줄 — leaf 모듈 전용)

코드가 실제 있는 leaf 모듈(core-resource, core-util, feature-xxx 등)에만 생성한다.

## {모듈명}/CLAUDE.md 골격
- **역할**: 이 모듈이 책임지는 것 (1~3줄)
- **절대 하면 안 되는 것**: 이 모듈에서 금지된 의존/패턴
- **의존성**
  - 의존하는 모듈:
  - 이 모듈에 의존하는 모듈:
- **명시되지 않은 규칙**: 코드에 안 드러나지만 팀이 지키는 암묵 규칙

---

## 상위 묶음 모듈 (app / core / data / domain / feature) — CLAUDE.md 만들지 않음
- 코드가 거의 없어 곧 decay 대상이 된다.
- 대신 **상위 모듈별 rule 파일** `docs/rules/{module}.md` 를 만들고, 루트 CLAUDE.md 조건부 로딩에 "접근 시 → @docs/rules/{module}.md" 를 건다. (존재하는 상위 모듈만)

## docs/rules/{module}.md 골격 (계층 경계 — 짧게)
- **역할**: 이 계층이 담당하는 것 (1~2줄)
- **의존 방향**: 의존 가능한 계층 / 의존 금지 계층
- **절대 금지**: 예) domain — 프레임워크 의존 금지(순수 Kotlin/Swift), feature — data 직접 의존 금지
- 일반형: app(모든 계층 의존 가능, 조립) · feature(domain만) · domain(순수) · data(domain만) · core(타 계층 의존 ❌, 모두가 의존)

## docs/MODULE_MAP.md 골격
- 모듈 트리 (상위 → leaf) + 각 leaf 의 한 줄 역할
- leaf 모듈별 CLAUDE.md 경로 링크 / 상위 모듈별 rule 파일 경로 링크
