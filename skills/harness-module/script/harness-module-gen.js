export const meta = {
  name: 'harness-module-gen',
  description: 'leaf 모듈 CLAUDE.md 병렬 생성 + 모듈별 6축 검증, 상위 rule fan-out, MODULE_MAP/루트 CLAUDE.md 단일 집계. 사람 게이트는 호출 스킬(harness-module)이 담당하고, 이 스크립트는 구조화 결과만 반환한다.',
  phases: [
    { title: 'Scout', detail: 'leaf/상위 분류 + 기존 문서 존재점검' },
    { title: 'Write', detail: 'leaf CLAUDE.md / 상위 rule 초안 병렬 작성' },
    { title: 'Verify', detail: 'leaf 문서 6축 검증 (write 직후)' },
    { title: 'Index', detail: 'MODULE_MAP + 루트 CLAUDE.md 조건부 로딩 단일 집계' },
    { title: 'VerifyAll', detail: '전체 신규 모듈 일관성 검증 (barrier 후 1회 — /harness-verify module 등가)' },
  ],
}

// ── args (harness-module 스킬이 전달) ───────────────────────────────
//   args.repoRoot     : 레포 루트 경로
//   args.moduleSchema  : leaf CLAUDE.md 스키마 경로 (shared/templates/module-claude.md)
//   args.ruleSchema    : 상위 모듈 rule 스키마 경로 (같은 템플릿의 "상위 모듈 rule" 섹션)
const repoRoot = (args && args.repoRoot) || '.'
const moduleSchema = (args && args.moduleSchema) || 'shared/templates/module-claude.md'
const ruleSchema = (args && args.ruleSchema) || moduleSchema

const RW = 'yeoboya-workflow-v2:harness-read-write'
const VERIFIER = 'yeoboya-workflow-v2:harness-doc-verifier'

// ── 구조화 스키마 ────────────────────────────────────────────────────
const SCOUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['leafMissing', 'upperMissing'],
  properties: {
    leafMissing: {
      type: 'array',
      description: 'CLAUDE.md 가 아직 없는 leaf 모듈 목록 (이미 있는 모듈은 제외)',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['path'],
        properties: {
          path: { type: 'string', description: '모듈 경로 (예: core/core-util)' },
          taskPath: { type: 'string', description: '빌드 태스크/타깃 경로 (예) Android: :core:core-util, iOS: 스킴/타깃명' },
        },
      },
    },
    upperMissing: {
      type: 'array',
      description: 'rule 파일이 아직 없는 상위 묶음 모듈 목록 (존재하는 상위 모듈만)',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'rulePath'],
        properties: {
          name: { type: 'string', description: '상위 모듈명 (예: core, feature)' },
          rulePath: { type: 'string', description: '생성할 rule 파일 경로 (docs/rules/{module}.md)' },
        },
      },
    },
  },
}

const WRITE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['path', 'tbd'],
  properties: {
    path: { type: 'string', description: '작성한 문서 경로' },
    tbd: {
      type: 'array',
      description: '코드에서 확정 못 해 {TBD} 로 남긴 항목 (없으면 빈 배열)',
      items: { type: 'string' },
    },
    summary: { type: 'string', description: '무엇을 근거로 무엇을 채웠는지 한두 줄' },
  },
}

const VERIFY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['path', 'verdict', 'findings'],
  properties: {
    path: { type: 'string' },
    verdict: { type: 'string', enum: ['pass', 'warn', 'block'], description: '6축 종합 판정' },
    findings: {
      type: 'array',
      description: '축별 발견 (문제 없으면 빈 배열)',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['axis', 'severity', 'note'],
        properties: {
          axis: {
            type: 'string',
            enum: ['모호성', '일관성', '완전성', '참조무결성', '레포실상일치', '압축도'],
          },
          severity: { type: 'string', enum: ['block', 'warn', 'nit'] },
          note: { type: 'string', description: '문제 + 구체적 수정 문안 (파일:라인 인용)' },
        },
      },
    },
  },
}

// 전체 모듈 일관성 검증 (barrier 후 1회) — 모듈 간 문서가 서로 어긋나지 않는지
const CROSS_VERIFY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['verdict', 'findings'],
  properties: {
    verdict: { type: 'string', enum: ['pass', 'warn', 'block'], description: '모듈 간 일관성 종합 판정' },
    findings: {
      type: 'array',
      description: '모듈 간 충돌/불일치 (없으면 빈 배열)',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['modules', 'severity', 'note'],
        properties: {
          modules: {
            type: 'array',
            description: '서로 어긋나는 모듈 경로들 (2개 이상)',
            items: { type: 'string' },
          },
          severity: { type: 'string', enum: ['block', 'warn', 'nit'] },
          note: { type: 'string', description: '무엇이 어떻게 어긋나는지 + 구체적 수정 문안' },
        },
      },
    },
  },
}

// ── 프롬프트 빌더 ────────────────────────────────────────────────────
function writeLeafPrompt(m) {
  return [
    `mode=create, 대상=module:${m.path}`,
    `레포 루트: ${repoRoot}`,
    `스키마(≤50줄): ${moduleSchema}`,
    `대상 모듈 코드를 Glob/Grep/Read 로 읽고 ${m.path}/CLAUDE.md 를 Write 한다.`,
    `역할/금지/의존성/암묵규칙만. 코드로 확인 못 한 값은 {TBD: 사유} 로 남긴다.`,
  ].join('\n')
}

function writeRulePrompt(u) {
  return [
    `mode=create, 대상=상위 모듈 rule (${u.name})`,
    `레포 루트: ${repoRoot}`,
    `스키마: ${ruleSchema} 의 "상위 모듈 rule" 섹션`,
    `${u.rulePath} 를 Write 한다. 내용 = 계층 경계 + 의존성 방향 + 절대 금지. 짧게.`,
  ].join('\n')
}

function verifyLeafPrompt(m) {
  return [
    `대상=module:${m.path}`,
    `레포 루트: ${repoRoot}`,
    `검증 문서: ${m.path}/CLAUDE.md`,
    `6축(모호성·일관성·완전성·참조무결성·레포실상일치·압축도)으로 검증. 수정하지 말고 진단만.`,
  ].join('\n')
}

function crossVerifyPrompt(paths) {
  const docList = paths.map((p) => `${p}/CLAUDE.md`).join(', ')
  return [
    `대상=이번에 새로 생성된 leaf 모듈 문서 전체`,
    `레포 루트: ${repoRoot}`,
    `검증 문서: ${docList}`,
    `이 문서들을 함께 읽고 6축 중 "일관성"만 집중 검증한다 — 모듈 간 역할/의존성 방향/금지 규칙/네이밍이 서로 어긋나지 않는지.`,
    `필요하면 인접 기존 모듈 CLAUDE.md 도 Glob/Read 로 참고한다. 수정하지 말고 진단만.`,
  ].join('\n')
}

function indexPrompt(scout, leaf, upper) {
  const leafPaths = leaf.filter(Boolean).map((r) => r.path).join(', ') || '(없음)'
  const rulePaths = upper.filter(Boolean).map((r) => r.path).join(', ') || '(없음)'
  return [
    `mode=update, 대상=root (인덱스/적재 규칙)`,
    `레포 루트: ${repoRoot}`,
    `이번에 새로 생성된 leaf CLAUDE.md: ${leafPaths}`,
    `이번에 새로 생성된 상위 rule: ${rulePaths}`,
    `1) docs/MODULE_MAP.md 를 생성/갱신해 전체 모듈(leaf/상위 매핑) 인덱스를 최신화한다.`,
    `2) 루트 CLAUDE.md 의 조건부 로딩 블록에 "각 상위 모듈 접근 시 → @docs/rules/{module}.md" 한 줄씩 추가한다.`,
    `기존 내용은 보존하고 최소 diff 로 Edit 한다. 공유 파일이므로 이 한 번의 호출에서만 수정한다.`,
  ].join('\n')
}

// ── 1) Scout: 분류 + 존재점검 → work-list 확정 ──────────────────────
phase('Scout')
const scout = await agent(
  [
    `${repoRoot} 의 멀티모듈 구조를 스캔한다 (Android: settings.gradle/build.gradle, iOS: Package.swift/*.xcworkspace/Podfile, 또는 소스 유무 근거).`,
    `- leaf 모듈(코드가 실제 있는 모듈: core-*, data-*, feature-* 등) 중 CLAUDE.md 가 없는 것만 leafMissing 에.`,
    `- 상위 묶음 모듈(app/core/data/domain/feature 같은 컨테이너) 중 docs/rules/{module}.md 가 없는 것만 upperMissing 에.`,
    `이미 문서가 있는 모듈은 제외한다. 추론이 아니라 코드 근거로만 분류한다.`,
  ].join('\n'),
  { label: 'scout', phase: 'Scout', schema: SCOUT_SCHEMA }
)

log(`leaf 신규 ${scout.leafMissing.length}개, 상위 rule 신규 ${scout.upperMissing.length}개`)

// ── 2) leaf: write → verify 파이프라인 (barrier 없음) ───────────────
const leaf = await pipeline(
  scout.leafMissing,
  (m) =>
    agent(writeLeafPrompt(m), {
      agentType: RW,
      schema: WRITE_SCHEMA,
      phase: 'Write',
      label: `write:${m.path}`,
    }),
  (_w, m) =>
    agent(verifyLeafPrompt(m), {
      agentType: VERIFIER,
      schema: VERIFY_SCHEMA,
      phase: 'Verify',
      label: `verify:${m.path}`,
    })
)

// ── 3) 상위 rule: 서로 다른 파일 → parallel ─────────────────────────
const upper = await parallel(
  scout.upperMissing.map((u) => () =>
    agent(writeRulePrompt(u), {
      agentType: RW,
      schema: WRITE_SCHEMA,
      phase: 'Write',
      label: `rule:${u.name}`,
    })
  )
)

// ── 4) 공유 파일 집계 (MODULE_MAP + 루트 CLAUDE.md) — 단일 1회 ────────
phase('Index')
if (scout.leafMissing.length || scout.upperMissing.length) {
  await agent(indexPrompt(scout, leaf, upper), {
    agentType: RW,
    phase: 'Index',
    label: 'index',
  })
} else {
  log('신규 문서 없음 — 집계 생략')
}

// ── 5) 전체 모듈 일관성 검증 (barrier 후 단일 1회) — /harness-verify module 등가 ──
//   모듈별 격리 검증(Verify)이 못 보는 "모듈 간 일관성"을 한 컨텍스트에서 본다.
phase('VerifyAll')
const createdLeafPaths = leaf.filter(Boolean).map((r) => r.path)
let crossModule = null
if (createdLeafPaths.length > 1) {
  crossModule = await agent(crossVerifyPrompt(createdLeafPaths), {
    agentType: VERIFIER,
    schema: CROSS_VERIFY_SCHEMA,
    phase: 'VerifyAll',
    label: 'verify:cross-module',
  })
} else {
  log('신규 leaf 1개 이하 — 모듈 간 일관성 검증 생략')
}

// ── 반환: 사람 게이트 입력 (게이트는 harness-module 스킬이 담당) ──────
const perModuleBlocked = leaf
  .filter(Boolean)
  .filter((r) => r.verdict === 'block')
  .map((r) => r.path)
const crossBlocked =
  crossModule && crossModule.verdict === 'block'
    ? crossModule.findings.filter((f) => f.severity === 'block').flatMap((f) => f.modules)
    : []

return {
  leaf: leaf.filter(Boolean),
  upper: upper.filter(Boolean),
  crossModule, // 모듈 간 일관성 검증 결과 (null = 생략됨)
  blocked: Array.from(new Set([...perModuleBlocked, ...crossBlocked])),
}
