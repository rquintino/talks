# `.claude/settings.json`: coding-only tools, skills and plugins

This repo's sessions are for coding. The settings keep only what that needs,
to cut context cost and keep personal connectors and data out.

| What | Setting | Effect (tested 8 Nov 2026, Claude Code 2.1.319) |
| --- | --- | --- |
| claude.ai plugins (`engineering`, `pdf-viewer`, `cowork-plugin-management`) | `enabledPlugins: false` | Not loaded: their skills **and** MCP servers (the `engineering` plugin alone brings 10, Gmail and Google Calendar among them) are gone. |
| Bundled skills not needed here | `skillOverrides: "off"` | Hidden from the listing and from `/name`. |
| Web search | `permissions.deny: ["WebSearch"]` | Tool removed from the session. |
| Claude Docs connector | `permissions.deny: ["mcp__Claude_Docs"]` | Tools removed on settings reload, also mid-session. |
| Other MCP servers | `PreToolUse` hook on `mcp__*` | **Allowlist**: only `github` and `claude-code-remote` calls run (details below). |
| Skills | `.claude/skill-allowlist.txt` + `.claude/hooks/skill-allowlist.sh` | **Allowlist**, see below. |

## Skill allowlist

`.claude/skill-allowlist.txt` names the skills Claude may use here, one per
line. Nothing else needs listing: whatever is not named is off, including
skills added later. `.claude/hooks/skill-allowlist.sh` (bash, grep and sed
only) enforces it in two ways:

- **`check`** (`PreToolUse` on `Skill`): Claude's call to any skill not on the
  list is refused. You can still type `/name` yourself.
- **`sync`** (`SessionStart`): it reads which claude.ai skills and plugins are
  installed, and writes `"off"` / `false` for every one not on the list to
  `.claude/settings.local.json`. That file is git-ignored, so the names of
  hidden skills never reach this public repo.

To allow a skill, add its name to the list (`plugin:<name>` keeps a claude.ai
plugin). Bundled Claude Code skills aren't on disk, so the ones not needed
are hidden by the static `skillOverrides` in `settings.json`.

**Limit, tested:** Claude Code builds the skill listing before the `sync`
hook's file exists and doesn't rebuild it mid-session. So in a **fresh
container (every cloud session)** the hidden skills still appear in the
listing and still cost context; they only can't be run. The listing shrinks
from the second launch in the same folder, e.g. on your own machine. To save
that context in cloud sessions too, turn unneeded skills off at claude.ai
(this affects chat as well).

`syncClaudeAiSkills` / `syncClaudeAiPlugins` (turn off all claude.ai skills or
plugins) are not read from project settings, only from user, local,
`--settings` or managed settings.

## Connector call blocking (mitigation)

> **This is a mitigation, not a fix, and far from perfect.** It worked in our
> tests on 8 Nov 2026 (Claude Code 2.1.319, cloud sessions on claude.ai/code).
> It is **not a security boundary**: anyone who can edit Claude Code's settings
> can switch it off, **including the agent itself** (see
> [Not a security boundary](#not-a-security-boundary)). It may stop working, or
> may not cover your setup. Test it yourself before relying on it.

### The problem

Connectors added to a claude.ai account (Microsoft 365, Gmail, Google Calendar,
Drive, Claude Docs and others) show up in every Claude Code **cloud session**.
This repo is public and needs none of them.

In cloud sessions, the host passes the connectors to Claude Code. Claude Code
doesn't fetch them itself, so the usual opt-outs don't reach them. See
[How connectors reach Claude Code](https://code.claude.com/docs/en/mcp#how-connectors-reach-claude-code).
We tried each of these. None of them removed the connectors from a cloud
session:

- `"disableClaudeAiConnectors": true` in `.claude/settings.json`
- `deniedMcpServers` with `serverUrl` patterns in `.claude/settings.json`
- `deniedMcpServers` with `serverName` entries in `.claude/settings.json`. In
  cloud sessions, connectors can load under ID-style names, so display names
  don't match.
- `ENABLE_CLAUDEAI_MCP_SERVERS=false` as a cloud environment variable. The
  variable reached the session, and the connectors loaded anyway.

### The mitigation

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

### Limits

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

### Not a security boundary

The hook lives in files the agent can write. Anyone who can edit Claude Code's
settings can switch it off, and that includes the agent. An agent could do it
after a **prompt injection** (hostile text in a web page, issue, file or tool
result) or simply by **going rogue**. Settings reload mid-session, so a change
takes effect at once. Ways to switch it off:

- Edit or delete `.claude/settings.json`.
- Add `"disableAllHooks": true` to `.claude/settings.local.json`, which outranks
  the project file. It also works from `~/.claude/settings.json`, unless the
  project file sets `"disableAllHooks": false`.
- In a cloud container the agent runs as root. It could likely write a managed
  settings file, which outranks everything. This is untested.
- Commit and push a change, so that every future session loads it.

What stands in the way:

- `.claude/` is a protected path. In the default permission mode, Claude Code
  asks you before each write there. In auto mode, an automated classifier
  decides instead. In our tests it allowed edits made on request, and
  refused to start a session meant to test switching the hook off. That's a judgement call, not a
  guarantee.
- Review every change to `.claude/` before it reaches `main`, e.g. with a branch
  rule that requires pull requests. The committed file is what new sessions
  load, so that review is the control that lasts.

If connector access must be impossible rather than discouraged, disconnect the
connectors from the claude.ai account. On Team or Enterprise plans, an admin can
block them with managed settings. Nothing in the repository or the container can
undo either.

For an account-wide switch, turn connectors off in the **+ → Connectors** menu
at claude.ai/code. It's documented for Projects threads
([Projects](https://code.claude.com/docs/en/claude-projects)), and the change
also turns them off in claude.ai chats.

### Related issues (anthropics/claude-code)

Requests for a proper control:

- [#106225: \[FEATURE\] Account-level setting to keep claude.ai connectors out of Claude Code on individual plans](https://github.com/anthropics/claude-code/issues/106225)
- [#26625: Allow disabling claude.ai MCP connectors per-client (Claude Code vs Chat)](https://github.com/anthropics/claude-code/issues/26625)
- [#22301: Add setting to disable cloud MCP connectors from claude.ai](https://github.com/anthropics/claude-code/issues/22301)
- [#45158: \[FEATURE\] Support disabling claude.ai MCP connectors at the project level](https://github.com/anthropics/claude-code/issues/45158)
- [#93722: Desktop app: worktree sessions reload every claude.ai connector; per-project disable list does not follow worktrees and deniedMcpServers cannot suppress app-injected connectors](https://github.com/anthropics/claude-code/issues/93722)
- [#106481: \[BUG\] Desktop Code tab ignores project disableClaudeAiConnectors: connectors are injected as sdk servers](https://github.com/anthropics/claude-code/issues/106481)

Remove this hook once Claude Code offers a supported way to turn connectors off
in cloud sessions.
