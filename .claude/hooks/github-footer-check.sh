#!/usr/bin/env bash
# PostToolUse hook on GitHub writes. Hand-written; uses only bash and cat.
# In Claude Code on the web, the GitHub server appends a footer linking the
# session (claude.ai/code/session_...) to text Claude posts, even with
# attribution.sessionUrl false (anthropics/claude-code#107892). Rule 1 of
# CLAUDE.md forbids session identifiers, so this reminds Claude to read the
# text back and remove the link. Editing the text afterwards keeps it removed.
cat > /dev/null
cat <<'J'
{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"CLAUDE.md Rule 1: the GitHub server may have appended a footer linking this session (claude.ai/code/session_...) to the text you just wrote. Read it back now. If the link is there, rewrite the text without it (update_pull_request for a PR body, update_issue_comment for a comment, issue_write for an issue) and read it back again to confirm."}}
J
exit 0
