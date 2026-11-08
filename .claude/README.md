# `.claude/settings.json`: block claude.ai connectors (mitigation)

> **This is a mitigation, not a fix.** It worked in our tests on 8 Nov 2026
> (Claude Code 2.1.319, cloud sessions on claude.ai/code). It may stop working,
> or may not cover your setup. Test it yourself before relying on it.

## The problem

Connectors added to a claude.ai account (Microsoft 365, Gmail, Google Calendar,
Drive, Claude Docs and others) show up in every Claude Code **cloud session**.
This repo is public and needs none of them.

In cloud sessions, the host passes the connectors to Claude Code. Claude Code
doesn't fetch them itself, so the usual opt-outs don't reach them. See
[How connectors reach Claude Code](https://code.claude.com/docs/en/mcp#how-connectors-reach-claude-code).
We tried each of these in the repo's `.claude/settings.json`. None of them
removed the connectors from a cloud session:

- `"disableClaudeAiConnectors": true`
- `deniedMcpServers` with `serverUrl` patterns
- `deniedMcpServers` with `serverName` entries. In cloud sessions, connectors
  can load under ID-style names, so display names don't match.

## The mitigation

A `PreToolUse` hook refuses every MCP tool call except the `github` and
`claude-code-remote` servers:

```json
"matcher": "^mcp__(?!github__|claude-code-remote__)"
```

The hook prints a "Blocked:" message and exits with code 2, which cancels the
call. It doesn't name any connector, so connectors added later are blocked too.
It uses no scripts or packages, only `echo` and `exit`.

To allow another server, add its name to the alternation, e.g.
`(?!github__|claude-code-remote__|myserver__)`.

## Limits

- **Calls are blocked, not hidden.** Connector tools still load and still use
  context. Claude can see them but can't run them.
- **It applies everywhere Claude Code reads this repo's settings**, including
  your own machine, where every MCP server except `github` and
  `claude-code-remote` is blocked.
- **It depends on the server names.** A connector that loads as `github` would
  get through. If the GitHub server is renamed, it gets blocked.
- **It needs the repo's hooks to load.** In a cloud session with several
  repositories, a repo's `.claude/settings.json` may not be read (see
  [Configure cloud environments](https://code.claude.com/docs/en/cloud-environments)).
  Admin-managed settings can also override it.
- **It has to be committed to each repository** where you want it.

For an account-wide switch, turn connectors off in the **+ → Connectors** menu
at claude.ai/code. It's documented for Projects threads
([Projects](https://code.claude.com/docs/en/claude-projects)), and the change
also turns them off in claude.ai chats.

## Related issues (anthropics/claude-code)

Requests for a proper control:

- [#106225: \[FEATURE\] Account-level setting to keep claude.ai connectors out of Claude Code on individual plans](https://github.com/anthropics/claude-code/issues/106225)
- [#26625: Allow disabling claude.ai MCP connectors per-client (Claude Code vs Chat)](https://github.com/anthropics/claude-code/issues/26625)
- [#22301: Add setting to disable cloud MCP connectors from claude.ai](https://github.com/anthropics/claude-code/issues/22301)
- [#45158: \[FEATURE\] Support disabling claude.ai MCP connectors at the project level](https://github.com/anthropics/claude-code/issues/45158)
- [#93722: Desktop app: worktree sessions reload every claude.ai connector; per-project disable list does not follow worktrees and deniedMcpServers cannot suppress app-injected connectors](https://github.com/anthropics/claude-code/issues/93722)
- [#106481: \[BUG\] Desktop Code tab ignores project disableClaudeAiConnectors: connectors are injected as sdk servers](https://github.com/anthropics/claude-code/issues/106481)

Remove this hook once Claude Code offers a supported way to turn connectors off
in cloud sessions.
