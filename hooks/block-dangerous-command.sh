#!/bin/bash
# Hook: 위험한 명령어 차단 (안전장치)
# Matcher: PreToolUse / Bash
# 폴더 삭제(rm -rf), 강제 푸시(git push --force), 히스토리 파괴(git reset --hard),
# DROP TABLE 등 되돌리기 어려운 명령을 감지하면 차단(exit 2)한다.
# 설계 원칙 3: hook 은 안전장치만. 검증/테스트/카운터는 넣지 않는다.
set -uo pipefail

input=$(cat)

# Fast path: Bash 가 아니면 즉시 통과
parsed=$(printf '%s' "$input" | node -e "
let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{
  try{const j=JSON.parse(s);
    console.log((j.tool_name||'')+'\t'+((j.tool_input&&j.tool_input.command)||''));
  }catch(e){console.log('\t')}
});
")
tool_name="${parsed%%$'\t'*}"
command="${parsed#*$'\t'}"

[ "$tool_name" != "Bash" ] && exit 0

# 위험 패턴 (필요 시 팀 정책에 맞게 보강)
patterns=(
  'rm[[:space:]]+-[a-zA-Z]*r[a-zA-Z]*f'   # rm -rf / rm -fr
  'rm[[:space:]]+-[a-zA-Z]*f[a-zA-Z]*r'
  'git[[:space:]]+push[[:space:]].*--force'
  'git[[:space:]]+push[[:space:]].*-f([[:space:]]|$)'
  'git[[:space:]]+reset[[:space:]]+--hard'
  'git[[:space:]]+clean[[:space:]]+-[a-zA-Z]*f'
  'DROP[[:space:]]+TABLE'
  'DROP[[:space:]]+DATABASE'
  'truncate[[:space:]]+table'
  'mkfs'
  ':\(\)\{.*\|.*&.*\};:'                    # fork bomb
)

for p in "${patterns[@]}"; do
  if printf '%s' "$command" | grep -Eiq "$p"; then
    echo "🛑 위험 명령 차단: 패턴 '$p' 감지" >&2
    echo "   명령: $command" >&2
    echo "   되돌리기 어려운 작업입니다. 정말 실행하려면 사람이 직접 수행하세요." >&2
    exit 2
  fi
done

exit 0
