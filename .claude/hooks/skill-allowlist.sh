#!/usr/bin/env bash
# Skill allowlist for this repository. Hand-written; uses only bash, grep, sed.
# The allowlist lives in .claude/skill-allowlist.txt.
#
#   sync   (SessionStart) Hide every installed claude.ai skill and plugin that
#          is not on the allowlist, by writing skillOverrides / enabledPlugins
#          to .claude/settings.local.json. That file is git-ignored, so the
#          names of hidden skills never reach this public repository.
#   check  (PreToolUse on Skill) Refuse any skill that is not on the allowlist.
set -u

dir="${CLAUDE_PROJECT_DIR:-$(pwd)}/.claude"
list="$dir/skill-allowlist.txt"
home="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"

allowed() {
  [ -f "$list" ] && sed 's/#.*//; s/[[:space:]]//g' "$list" | grep -qxF -- "$1"
}

case "${1:-}" in
  check)
    s=$(tr -d '\n' | grep -o '"skill"[[:space:]]*:[[:space:]]*"[^"]*"' | head -n 1 | sed 's/.*"\([^"]*\)"$/\1/')
    if [ -n "$s" ] && allowed "$s"; then exit 0; fi
    echo "Blocked: skill '$s' is not on this repository's allowlist (.claude/skill-allowlist.txt)." >&2
    exit 2
    ;;

  sync)
    out="$dir/settings.local.json"
    owned="$dir/.skill-allowlist-owned"
    # Never overwrite a settings.local.json someone wrote by hand.
    if [ -f "$out" ] && ! { [ -f "$owned" ] && cmp -s "$out" "$owned"; }; then
      echo "skill-allowlist: $out exists and was not written by this hook; left unchanged." >&2
      exit 0
    fi
    ok='^[A-Za-z0-9][A-Za-z0-9._-]*$'
    skills=""
    for f in "$home"/skills/synced/*/*/SKILL.md; do
      [ -f "$f" ] || continue
      n=$(basename "$(dirname "$f")")
      printf '%s' "$n" | grep -qE "$ok" || continue
      allowed "anthropic-skills:$n" && continue
      skills="$skills${skills:+,}
    \"anthropic-skills:$n\": \"off\""
    done
    plugins=""
    for p in "$home"/plugins/synced/*/*/; do
      [ -d "$p" ] || continue
      n=$(basename "$p")
      printf '%s' "$n" | grep -qE "$ok" || continue
      allowed "plugin:$n" && continue
      plugins="$plugins${plugins:+,}
    \"$n@synced\": false"
    done
    printf '{\n  "skillOverrides": {%s\n  },\n  "enabledPlugins": {%s\n  }\n}\n' "$skills" "$plugins" > "$out"
    cp "$out" "$owned"
    exit 0
    ;;

  *)
    echo "usage: skill-allowlist.sh sync|check" >&2
    exit 1
    ;;
esac
