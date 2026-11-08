#!/usr/bin/env bash
# MCP allowlist for this repository. Hand-written; uses only bash, grep, sed.
# PreToolUse hook on mcp__*: refuses a call unless its server is named in
# .claude/mcp-allowlist.txt or in $TALKS_MCP_ALLOW (space-separated,
# set in the cloud environment so connector IDs never reach the repo).
set -u

list="${CLAUDE_PROJECT_DIR:-$(pwd)}/.claude/mcp-allowlist.txt"

t=$(tr -d '\n' | grep -o '"tool_name"[[:space:]]*:[[:space:]]*"[^"]*"' | head -n 1 | sed 's/.*"\([^"]*\)"$/\1/')
s=$(printf '%s' "$t" | sed -n 's/^mcp__\(.*\)__[^_].*$/\1/p')
s=${s%%__*}

if [ -n "$s" ]; then
  if [ -f "$list" ] && sed 's/#.*//; s/[[:space:]]//g' "$list" | grep -qxF -- "$s"; then exit 0; fi
  for x in ${TALKS_MCP_ALLOW:-}; do
    [ "$x" = "$s" ] && exit 0
  done
fi
echo "Blocked: MCP server '$s' is not on this repository's allowlist (.claude/mcp-allowlist.txt)." >&2
exit 2
