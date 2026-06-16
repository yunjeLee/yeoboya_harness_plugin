#!/usr/bin/env bash
# harness-update 스코핑: 변경분(git diff) → 갱신 후보 하네스 문서 목록.
# 워크플로우 JS 는 파일시스템/git 에 접근하지 못하므로, 결정론적 git 매핑은
# 스킬이 이 스크립트로 먼저 수행하고 그 결과(후보 문서)를 워크플로우에 넘긴다.
#
# 사용: harness-update-scope.sh <repoRoot> [--full]
# 출력(stdout, 탭 구분):
#   MODE<TAB><incremental|full>
#   BASE<TAB><baseSha|->
#   DOC<TAB><module|root|rule><TAB><docPath>
set -euo pipefail

repoRoot="${1:-.}"
full="${2:-}"
cd "$repoRoot"

marker=".harness/last-update"
baseSha=""
[ -f "$marker" ] && baseSha="$(tr -d '[:space:]' < "$marker")"

# baseSha 가 유효한 커밋이 아니면(리베이스 등) 전체 스윕으로 강등
if [ -n "$baseSha" ] && ! git cat-file -e "${baseSha}^{commit}" 2>/dev/null; then
  baseSha=""
fi

emit_doc() { printf 'DOC\t%s\t%s\n' "$1" "$2"; }

root_docs() {
  for f in docs/ARCHITECTURE.md docs/CONVENTIONS.md docs/SESSION.md CLAUDE.md; do
    [ -f "$f" ] && emit_doc root "$f"
  done
}
all_rules() {
  for f in docs/rules/*.md; do [ -f "$f" ] && emit_doc rule "$f"; done
}
all_modules() {
  # 루트 CLAUDE.md 를 제외한 모든 모듈 CLAUDE.md
  find . -name CLAUDE.md -not -path './CLAUDE.md' -not -path './.git/*' 2>/dev/null \
    | sed 's|^\./||' | while IFS= read -r f; do emit_doc module "$f"; done
}

# 변경분 기준이 없으면(최초 실행) 또는 --full 이면 전체 스윕
if [ "$full" = "--full" ] || [ -z "$baseSha" ]; then
  printf 'MODE\tfull\n'
  printf 'BASE\t-\n'
  { root_docs; all_rules; all_modules; } | sort -u
  exit 0
fi

printf 'MODE\tincremental\n'
printf 'BASE\t%s\n' "$baseSha"

changed="$(git diff --name-only "${baseSha}..HEAD" 2>/dev/null || true)"
[ -z "$changed" ] && exit 0

{
  structural=0
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    # 구조 파일 변경 → 루트 ARCHITECTURE/CONVENTIONS 후보 신호
    case "$f" in
      settings.gradle*|build.gradle*|*/build.gradle*|*.gradle|*/AndroidManifest.xml|*/di/*|*/inject/*) structural=1 ;;
    esac
    # 변경 파일 → 가장 가까운 조상 CLAUDE.md (= 그 모듈 문서)
    d="$(dirname "$f")"
    while [ "$d" != "." ] && [ "$d" != "/" ]; do
      if [ -f "$d/CLAUDE.md" ]; then
        emit_doc module "$d/CLAUDE.md"
        top="${d%%/*}"
        [ -f "docs/rules/$top.md" ] && emit_doc rule "docs/rules/$top.md"
        break
      fi
      d="$(dirname "$d")"
    done
  done <<< "$changed"
  if [ "$structural" = "1" ]; then
    [ -f docs/ARCHITECTURE.md ] && emit_doc root docs/ARCHITECTURE.md
    [ -f docs/CONVENTIONS.md ] && emit_doc root docs/CONVENTIONS.md
  fi
} | sort -u
