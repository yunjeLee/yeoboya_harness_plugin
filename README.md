# yeoboya-workflow-v2

앱팀(Android / iOS) 공통 **harness-engineering** 워크플로우 플러그인 V2.
계획 → TDD → 검증 → bug-fix 로 이어지는 **닫힌 루프**를 구성하고, 하네스 문서(규칙)로 Claude Code 에 프로젝트 그래프를 제공한다.

## 설계 원칙 (V2)
1. **한 스킬 = 한 파일.** 작은 스킬은 자체완결, 큰 스킬만 `shared/` 1개 참조.
2. **거대 템플릿 금지 (≤50줄).** 긴 예시가 아니라 짧은 스키마.
3. **hook 은 안전장치만.** 검증·테스트·카운터는 스킬 내부에서.
4. **상태를 파일로 영속화.** `.harness/run-{id}.md` 로 세션 간 인수인계.

## 구성

### Skills (8)
| 스킬 | 역할 |
|------|------|
| `harness-root` | 루트 문서 7종(+UI_GUIDE) 초안 생성 |
| `harness-root-edit` | 루트 문서 인자 대상 편집 |
| `harness-module` | leaf 모듈 CLAUDE.md + MODULE_MAP 병렬 생성 |
| `harness-module-edit` | 모듈 CLAUDE.md 인자 대상 갱신 (decay 진입점) |
| `harness-verify` | root/module 문서 6축 검증 (공용) |
| `harness-check` | 산출물↔하네스 불일치 진단 → Notion 기록 |
| `work` | 닫힌 루프 엔진 (입력→계획→검토→TDD→검증) |
| `bug-fix` | 검증 실패 자동 수정 루프 (최대 5회) |

### Sub-agents (3)
- `harness-read-write` — 코드 읽고 문서 초안 작성 (sonnet)
- `harness-doc-verifier` — 문서 6축 검증 (opus, 대상=문서/생성 후)
- `plan-reviewer` — 계획 7축 검토 (opus, 대상=계획/실행 전)

### Hooks (2, 안전장치만)
- `block-dangerous-command.sh` — 위험 명령 차단 (PreToolUse/Bash)
- `harness-decay-notify.sh` — 문서 decay 알림 (PostToolUse/Bash)

## 사용 Flow
```
0. /harness-root, /harness-module  →  검증 agent(6축) → 사람 승인
1. /work  →  입력 → /brainstorming → 계획 검토 agent(7축) → 사람 게이트
            → .harness/run-{id}.md 기록
2. TDD 코드 작성 (자동)
3. 완료기준(실행명령) 검증 (자동)
   └ 실패 → bug-fix (≤5회 재시도, >5회 → /harness-check 자동)
※ 산출물이 하네스와 다르면 언제든 /harness-check (수정은 사람)
```

- **자동 구간**: TDD → 완료기준 검증 → bug-fix
- **사람 게이트**: ① 하네스 문서 반영(가드레일 변경), ② 커밋/푸시

## 상태 파일
- `.harness/run-{id}.md` — 진행 상태(계획/단계/bug-fix 횟수/완료기준). work 가 생성, bug-fix 가 갱신.
- `docs/harness-issues/` — Notion 기록 실패 시 harness-check 로컬 폴백.

> 뼈대(스캐폴딩) 상태입니다. 각 스킬의 세부 오케스트레이션 로직은 점진적으로 채워나갑니다.
