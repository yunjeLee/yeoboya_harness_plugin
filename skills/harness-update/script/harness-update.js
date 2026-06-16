export const meta = {
  name: 'harness-update',
  description:
    '스코핑된 하네스 문서 후보를 6축 검증으로 drift(레포 실상 불일치) 감지 → 썩은 문서만 최소 diff 갱신 → 재검증. 사람 게이트와 git 스코핑은 호출 스킬(harness-update)이 담당하고, 이 스크립트는 구조화 결과만 반환한다.',
  phases: [
    { title: 'Detect', detail: '후보 문서 6축 검증으로 drift 감지 (레포실상일치 최우선)' },
    { title: 'Update', detail: 'drift 문서만 최소 diff 갱신' },
    { title: 'Reverify', detail: '갱신본 재검증' },
  ],
}

// ── args (harness-update 스킬이 전달) ───────────────────────────────
//   args.repoRoot     : 레포 루트 경로
//   args.candidates    : [{ path, kind:'module'|'root'|'rule' }] — 스코핑 스크립트가 고른 후보
//   args.moduleSchema  : module CLAUDE.md 스키마 경로
//   args.rootSchema    : 루트/rule 문서 스키마 경로
const repoRoot = (args && args.repoRoot) || '.'
const candidates = (args && args.candidates) || []
const moduleSchema = (args && args.moduleSchema) || 'shared/templates/module-claude.md'
const rootSchema = (args && args.rootSchema) || 'shared/templates/root-docs.md'

const RW = 'yeoboya-workflow-v2:harness-read-write'
const VERIFIER = 'yeoboya-workflow-v2:harness-doc-verifier'

// ── 구조화 스키마 ────────────────────────────────────────────────────
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

const UPDATE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['path', 'tbd'],
  properties: {
    path: { type: 'string', description: '갱신한 문서 경로' },
    tbd: {
      type: 'array',
      description: '코드에서 확정 못 해 {TBD} 로 남긴 항목 (없으면 빈 배열)',
      items: { type: 'string' },
    },
    summary: { type: 'string', description: '무엇을 왜 바꿨는지 한두 줄 (변경 없으면 그렇게 명시)' },
  },
}

// ── 헬퍼 ─────────────────────────────────────────────────────────────
const moduleDir = (p) => p.replace(/\/CLAUDE\.md$/, '')
const targetOf = (c) => (c.kind === 'module' ? `module:${moduleDir(c.path)}` : 'root')
const schemaOf = (c) => (c.kind === 'module' ? moduleSchema : rootSchema)

// drift = 문서가 현재 코드와 어긋나 썩었다는 신호.
// "레포실상일치" 발견(warn/block) 또는 종합 block 일 때만 갱신 대상으로 본다
// — 그래야 "필요한 부분만" 고치고 멀쩡한 문서를 건드리지 않는다.
function isDrifted(d) {
  if (!d) return false
  if (d.verdict === 'block') return true
  return (d.findings || []).some(
    (f) => f.axis === '레포실상일치' && (f.severity === 'block' || f.severity === 'warn')
  )
}

function detectPrompt(c) {
  return [
    `대상=${targetOf(c)}`,
    `레포 루트: ${repoRoot}`,
    `검증 문서: ${c.path}`,
    `6축으로 검증하되 "레포실상일치"(문서가 현재 코드와 어긋나 썩었는지)를 최우선으로 본다.`,
    `문서가 코드와 일치하면 findings 를 비워 pass 로 반환한다. 수정하지 말고 진단만.`,
  ].join('\n')
}

function updatePrompt(d, c) {
  const findingLines =
    (d.findings || []).map((f) => `- [${f.axis}/${f.severity}] ${f.note}`).join('\n') || '- (종합 block)'
  return [
    `mode=update, 대상=${targetOf(c)}`,
    `레포 루트: ${repoRoot}`,
    `스키마: ${schemaOf(c)}`,
    `갱신 문서: ${c.path}`,
    `이 문서는 현재 코드와 어긋난 부분이 있다(아래 검증 발견). 기존 내용은 보존하고`,
    `어긋난 부분만 최소 diff 로 Edit 한다. module CLAUDE.md 는 갱신 후에도 ≤50줄 유지.`,
    `검증 발견:`,
    findingLines,
  ].join('\n')
}

// ── 1) Detect: 후보 전체를 6축 검증해 drift 가려낸다 (barrier) ────────
//   barrier 정당화: drift 0건이면 갱신 단계를 통째로 건너뛰고(early-exit),
//   사람 게이트에 "스캔 N / 갱신 M / 멀쩡 K" 전체 그림을 보여줘야 한다.
phase('Detect')
const detected = (await parallel(
  candidates.map((c) => () =>
    agent(detectPrompt(c), {
      agentType: VERIFIER,
      schema: VERIFY_SCHEMA,
      phase: 'Detect',
      label: `detect:${c.path}`,
    }).then((v) => v && { ...v, kind: c.kind })
  )
)).filter(Boolean)

const stale = detected.filter(isDrifted)
const clean = detected.filter((d) => !isDrifted(d)).map((d) => d.path)

if (!stale.length) {
  log(`후보 ${candidates.length}개 — drift 없음, 갱신 생략`)
  return {
    scanned: detected.map((d) => ({ path: d.path, verdict: d.verdict })),
    updated: [],
    clean,
    blocked: [],
  }
}
log(`후보 ${candidates.length}개 중 drift ${stale.length}개 — 갱신 진행`)

// ── 2) Update → Reverify 파이프라인 (barrier 없음, 문서마다 독립) ─────
//   각 문서는 서로 다른 파일이라 병렬 안전(공유 집계 파일 없음).
phase('Update')
const updated = (await pipeline(
  stale,
  (d) =>
    agent(updatePrompt(d, d), {
      agentType: RW,
      schema: UPDATE_SCHEMA,
      phase: 'Update',
      label: `update:${d.path}`,
    }),
  (w, d) =>
    agent(detectPrompt(d), {
      agentType: VERIFIER,
      schema: VERIFY_SCHEMA,
      phase: 'Reverify',
      label: `reverify:${d.path}`,
    }).then((rv) => ({
      path: d.path,
      summary: (w && w.summary) || '',
      tbd: (w && w.tbd) || [],
      reverify: rv,
    }))
)).filter(Boolean)

// ── 반환: 사람 게이트 입력 (게이트는 harness-update 스킬이 담당) ──────
const blocked = updated
  .filter((u) => u.reverify && u.reverify.verdict === 'block')
  .map((u) => u.path)

return {
  scanned: detected.map((d) => ({ path: d.path, verdict: d.verdict })),
  updated, // [{ path, summary, tbd, reverify:{verdict,findings} }]
  clean, // drift 없어 건드리지 않은 문서
  blocked, // 갱신 후에도 verdict=block — 사람이 edit 스킬로 마무리
}
