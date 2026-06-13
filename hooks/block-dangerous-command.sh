#!/bin/bash
# Hook: 위험한 명령어 차단 (안전장치)
# Matcher: PreToolUse / Bash
# 폴더 삭제(rm -rf), 강제 푸시(git push --force), 히스토리 파괴(git reset --hard),
# DROP TABLE 등 되돌리기 어려운 명령을 감지하면 차단(exit 2)한다.
# 설계 원칙 3: hook 은 안전장치만. 검증/테스트/카운터는 넣지 않는다.
set -uo pipefail

input=$(cat)

# matcher 가 이미 Bash 로 한정 → tool_name 재파싱 불필요.
# raw input 전체를 위험 패턴으로 검사한다. 외부 런타임(node/jq) 의존 0.
# 파싱 실패 개념이 없으므로 fail-open 이 구조적으로 불가능하다.

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
  if printf '%s' "$input" | grep -Eiq "$p"; then
    echo "🛑 위험 명령 차단: 패턴 '$p' 감지" >&2
    echo "   입력에서 되돌리기 어려운 작업 패턴이 감지되었습니다." >&2
    echo "   되돌리기 어려운 작업입니다. 정말 실행하려면 사람이 직접 수행하세요." >&2
    exit 2
  fi
done

exit 0
