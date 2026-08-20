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

Every skill has `disable-model-invocation: true`. Installing Agent Lab does not change ordinary chats. Invoke a skill explicitly when you want to test it.

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
