#!/bin/bash
# Hook: work 완료기준 누락 차단 (품질 게이트)
# Matcher: PreToolUse / Write
# .harness/runs/run-*.md 를 Write 할 때, 완료기준 마커 블록
#   <!-- COMPLETION-CRITERIA:START --> ~ <!-- COMPLETION-CRITERIA:END -->
# 안에 "- [ ] <실행명령>"(명령 텍스트가 실제로 있는 체크박스)이 하나도 없으면
# 차단(exit 2)하고 완료기준 작성을 요구한다.
# 설계 원칙 3: hook 은 게이트만. 검증/테스트/카운터는 스킬 내부에서.
#
# 왜 마커 구간만 보나: run 파일은 진행 상태·계획 목록 등에도 체크박스를 쓴다.
# 파일 전역에서 "- [ ]" 를 찾으면 완료기준이 비어도 다른 섹션 때문에 항상 통과한다.
set -uo pipefail

input=$(cat)

# 대상 아님(run 파일 아님) → 통과. 비대상은 검사 자체가 무의미.
case "$input" in
  *".harness/runs/run-"*) ;;
  *) exit 0 ;;
esac

block() {
  echo "🛑 완료기준 미작성: run 파일의 완료기준 마커 블록이 비어 있습니다." >&2
  echo "   work 의 완료기준을 아래 형식으로 먼저 작성하세요:" >&2
  echo "     <!-- COMPLETION-CRITERIA:START -->" >&2
  echo "     ## 완료기준(실행명령)" >&2
  echo "     - [ ] <실행 명령>" >&2
  echo "     <!-- COMPLETION-CRITERIA:END -->" >&2
  echo "   (완료기준 없는 run 파일은 bug-fix 루프의 빈 입력이 됩니다.)" >&2
  exit 2
}

# JSON content 의 \n 이스케이프를 실제 개행으로 디코드(마커/체크박스 행 단위 판정용).
# 다른 이스케이프(\")는 남지만 마커·체크박스 탐지에는 무관.
decoded=$(printf '%s' "$input" | sed 's/\\n/\
/g')

# 마커 블록이 둘 다 있어야 한다. 없으면 완료기준 섹션 누락 → 차단.
printf '%s' "$decoded" | grep -q 'COMPLETION-CRITERIA:START' || block
printf '%s' "$decoded" | grep -q 'COMPLETION-CRITERIA:END'   || block

# START~END 사이 구간만 추출.
segment=$(printf '%s' "$decoded" | awk '
  /COMPLETION-CRITERIA:START/ { f=1; next }
  /COMPLETION-CRITERIA:END/   { f=0 }
  f')

# 구간 안에 "- [ ] <명령 텍스트>" (체크박스 뒤에 비공백 내용)이 1줄 이상이면 통과.
# 빈 체크박스("- [ ]" 만 있고 명령 없음)는 통과시키지 않는다.
if printf '%s' "$segment" | grep -Eq '^[[:space:]]*- \[( |x|X)\][[:space:]]*[^[:space:]]'; then
  exit 0
fi

block
