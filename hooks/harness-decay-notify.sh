#!/bin/bash
# Hook: 하네스 문서 decay 알림 (안전장치)
# Matcher: PostToolUse / Bash
# git commit 직후, 모듈 디렉토리의 누적 변경 라인 또는 CLAUDE.md 마지막 수정 경과일이
# 임계치를 넘으면 stderr 로 알림 + /harness-module-edit 유도. commit 은 차단하지 않음(exit 0).
# 설계 원칙 3: 알림만. 검증/카운터는 스킬 내부에서 처리한다.
set -uo pipefail

input=$(cat)

# matcher=Bash + raw "git commit" 매칭으로 충분. node 불필요.
# 알림 hook 이므로 오탐이 나도 exit 0(통과) — commit 을 막지 않는다.
case "$input" in
  *"git commit"*) ;;
  *) exit 0 ;;
esac

# 임계치 (팀 정책에 맞게 조정)
LINE_THRESHOLD=200   # 마지막 커밋 대비 모듈 누적 변경 라인
DAY_THRESHOLD=30     # CLAUDE.md 마지막 수정 경과일

# 직전 커밋에서 변경된 CLAUDE.md 보유 모듈을 찾아 decay 점검
changed=$(git diff --name-only HEAD~1 HEAD 2>/dev/null) || exit 0
echo "$changed" | grep -oE '^([^/]+/)*' | sort -u | while read -r dir; do
  [ -z "$dir" ] && continue
  claude_md="${dir}CLAUDE.md"
  [ -f "$claude_md" ] || continue

  # 모듈 누적 변경 라인
  lines=$(git diff --numstat HEAD~1 HEAD -- "$dir" 2>/dev/null | awk '{a+=$1+$2} END{print a+0}')
  # CLAUDE.md 경과일
  last_mod=$(git log -1 --format=%ct -- "$claude_md" 2>/dev/null || echo 0)
  now=$(date +%s)
  days=$(( (now - last_mod) / 86400 ))

  if [ "${lines:-0}" -ge "$LINE_THRESHOLD" ] || [ "$days" -ge "$DAY_THRESHOLD" ]; then
    echo "📉 하네스 decay 의심: $claude_md (누적 변경 ${lines}줄 / 마지막 갱신 ${days}일 전)" >&2
    echo "   코드가 문서보다 앞서갔을 수 있습니다 → /harness-module-edit ${dir%/} 로 갱신을 검토하세요." >&2
  fi
done

exit 0
