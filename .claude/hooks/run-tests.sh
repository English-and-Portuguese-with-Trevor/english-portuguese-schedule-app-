#!/usr/bin/env bash
# Claude Code hook: runs the test suite and, if it fails, sends the failures
# back to Claude (exit 2) so they get fixed before the push or before the
# turn ends. Wired in .claude/settings.json to two events:
#   - PreToolUse on `git push`: a red run blocks the push.
#   - Stop: runs only when the turn leaves uncommitted changes.
# Same file in every repo.
set -u
cd "$(dirname "$0")/../.." || exit 0

input=$(cat)
event=$(printf '%s' "$input" | sed -n 's/.*"hook_event_name":[[:space:]]*"\([A-Za-z]*\)".*/\1/p')

if [ "$event" = "Stop" ]; then
  # Claude is already continuing because this hook sent it back once: let it stop.
  printf '%s' "$input" | grep -Eq '"stop_hook_active":[[:space:]]*true' && exit 0
  # Nothing changed since the last commit: nothing to test.
  [ -n "$(git status --porcelain 2>/dev/null)" ] || exit 0
  # Fresh container without dependencies: don't force an install at every stop.
  [ -d node_modules ] || exit 0
elif [ ! -d node_modules ]; then
  echo "node_modules is missing, so the tests have not run. Install dependencies (npm ci) and run the tests before pushing." >&2
  exit 2
fi

out=$(npx vitest run 2>&1)
status=$?
[ "$status" -eq 0 ] && exit 0

printf '%s\n' "$out" | tail -n 80 >&2
echo "The tests failed (output above). Fix them before finishing or pushing, or explain why they can't be fixed." >&2
exit 2
