#!/bin/bash
# Hook: work 완료기준 누락 차단 (품질 게이트)
# Matcher: PreToolUse / Write
# .harness/runs/run-*.md 를 쓸 때 완료기준 체크박스(- [ ] / - [x])가
# 하나도 없으면 차단(exit 2)하고 완료기준 작성을 요구한다.
# 설계 원칙 3: hook 은 게이트만. 검증/테스트/카운터는 스킬 내부에서.
set -uo pipefail

input=$(cat)

# matcher=Write 이지만 file_path 로 run 파일만 대상화. node/jq 없이 raw grep.
# 대상 아님(run 파일 아님) → 통과. fail-open 아님: 비대상은 검사 자체가 무의미.
case "$input" in
  *".harness/runs/run-"*) ;;
  *) exit 0 ;;
esac

# 완료기준 체크박스가 하나라도 있으면 통과. 하나도 없으면 차단.
# JSON content 안의 "- [ ]" / "- [x]" 를 raw 로 탐지(\n 이스케이프 무관).
if printf '%s' "$input" | grep -Eq '\- \[( |x|X)\]'; then
  exit 0
fi

echo "🛑 완료기준 미작성: run 파일에 완료기준 체크리스트가 없습니다." >&2
echo "   work 의 완료기준을 '- [ ] <실행 명령>' 형식으로 먼저 작성하세요." >&2
echo "   (완료기준 없는 run 파일은 bug-fix 루프의 빈 입력이 됩니다.)" >&2
exit 2
