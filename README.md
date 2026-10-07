# Agent Lab

Experimental agent workflows for GitHub Copilot. This repository complements [agent-plugin](https://github.com/amunger/agent-plugin), which remains the stable home for personal instructions and routine commands.

Agent Lab is separate because these workflows use heavier multi-model orchestration, include modified third-party material, and will change faster while they are evaluated. A workflow can move into `agent-plugin` after it proves useful and stable.

The first experiment is a small, explicit-only adaptation of [pstack](https://github.com/cursor/plugins/tree/main/pstack). It keeps workflows that can be evaluated independently:

- `/aamunger-mode`
- `/how`
- `/why`
- `/arena`
- `/architect`
- `/interrogate`
- `/swarm`
- `/tdd`
- `/no-comments`
- `/create-verification-skill`
- `/maintain-verification-skill`

It also includes the `comment-sicko` custom agent used by `/no-comments`.

Every skill has `disable-model-invocation: true`. Invoke a skill explicitly when you want to test it. The disk-cleanup MCP tools are also available to the agent; they are read-only and never remove files.

## Disk cleanup app

Invoke `/disk-cleanup` with the machine/roots to inspect. The agent measures large
directories, verifies their purpose and preservation evidence, and presents an
interactive list with checkboxes, size estimates, modification dates, reasons and
risk warnings. Recommendations are not limited to worktrees: large reproducible
build artifacts (including those in a Copilot runtime checkout when present),
caches and dependency trees are first-class candidates.

Worktrees qualify after **more than 7 days** of inactivity when removal is
recoverable, or **more than 30 days** with an explicit possible-data-loss warning.
Commit age and stale remote-tracking refs do not establish inactivity or safety.
All selections start unchecked. Parent/child overlap is rejected to avoid double
counting and ambiguous removal scope.

**Clean up selected** uses the MCP Apps `ui/message` API to hand a new user prompt
to the current chat. The host may require pressing Send in the composer. The
server and app cannot delete anything; the agent rechecks only selected paths
before acting. Warnings require acknowledgement in the UI, and actual data loss
still needs separate approval. Worktree removal preserves branches.

The plugin registers its bundled stdio server through [.mcp.json](.mcp.json).
Requires Node.js 22+ on the plugin host. Bundles under [mcp/dist](mcp/dist) are
checked in so plugin installation does not require an npm install or network
access. Enable/trust the `disk-cleanup` server if VS Code prompts, then start a
new chat after updating the plugin. Remote sessions inspect the MCP server's
machine, not necessarily the computer displaying the app.

### Develop and preview

```powershell
npm ci
npm run build
npm run check
npm test
npm run test:app
npm run preview
```

Browser tests use an installed Microsoft Edge, or the executable specified by
`MCP_APP_BROWSER`. The preview serves only on loopback and displays **illustrative
data**, including a fictitious Copilot runtime build directory. It uses the real
bundled MCP server and MCP Apps bridge, but captures the cleanup prompt instead of
sending it to a real chat or deleting files. Open the printed URL. Stop the server
when finished. The preview HTML is self-contained and can also be saved/opened
offline; it still only captures prompts.

When changing app code, rebuild and include the generated bundles with the source.
Runtime dependency licenses are collected in
[mcp/dist/THIRD_PARTY_LICENSES.txt](mcp/dist/THIRD_PARTY_LICENSES.txt).

## Install

In VS Code, run **Chat: Install Plugin From Source** and select this directory.

For Copilot CLI:

```shell
copilot plugin install .
```

Start a new chat after installing or updating the plugin.

## Trial workflow

Keep your normal Copilot agent as the default.

1. Use `/how` on a subsystem you already understand.
2. Use `/interrogate` on a modest real diff.
3. Use `/arena` only when two or more implementations are genuinely plausible.
4. Use `/aamunger-mode` for one bounded task and compare it with your normal workflow.

The plugin intentionally omits pstack's sticky `poteto-mode`, automatic skills, model setup, Graphite shipping flows, long-running orchestration, personal transcript mining, and Benny automations.

## Upstream

The imported skills and agent started from pstack version 0.14.1 and were adapted for Copilot, explicit invocation, lower default fan-out, and fewer cross-skill dependencies. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and [LICENSE](LICENSE).
