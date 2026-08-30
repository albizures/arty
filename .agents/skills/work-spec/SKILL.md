---
name: work-spec
description: Work the next local spec task frontier under .scratch; when no task is available, run quality checks and create follow-up tasks from failures.
---

Work one cycle of a local spec effort.

Issue tracker conventions live in `docs/agents/issue-tracker.md`; triage labels live in `docs/agents/triage-labels.md`; quality commands live in `docs/agents/coding-standards/quality.md`. Read those files before acting.

## Inputs

The user may name a feature slug, a `.scratch/<feature-slug>/` directory, a spec path, or an issue path. If they do not, discover local efforts under `.scratch/`. If there is exactly one effort, use it. If there are several, ask which one to work. If `.scratch/` does not exist or no effort can be inferred, stop and ask for the spec effort.

If a quality gate needs `pnpm health -- <base-ref>` and the user did not provide the base ref, run the other quality commands first, then ask for the base ref only if no tasks were created from earlier failures.

## Cycle

### 1. Find the frontier

Scan `.scratch/<feature-slug>/issues/*.md`.

A frontier task is an issue where:

- `Status:` is `ready-for-agent`.
- `Blocked by:` is empty, `None`, or every listed issue number is `resolved`.

Lowest issue number wins. Before implementation, claim the task by changing its `Status:` to `claimed`.

### 2. If a frontier task exists, implement it

Use `/implement` on the claimed task. Pass along any spec path and the task path so implementation has the full context.

When implementation is complete:

- Set the task `Status:` to `resolved` only if its acceptance criteria are met and the applicable quality gate from `docs/agents/coding-standards/quality.md` is satisfied.
- Append a short `## Result` note if the issue does not already have one.

Then stop. One `work-spec` cycle handles one implementation task.

### 3. If no frontier task exists, run quality

Run the configured quality commands from `docs/agents/coding-standards/quality.md`:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm mutation
pnpm health -- <base-ref>
```

`pnpm health` requires an explicit base ref. Do not guess it.

### 4. Create tasks from quality failures

For each independently fixable failure class, create one new issue under `.scratch/<feature-slug>/issues/` using the next issue number. Group related failures that should be fixed in one coherent pass; split unrelated failures so later cycles can claim them independently.

Each generated issue must include:

- `Status: ready-for-agent`.
- `Blocked by: None (can start immediately)` unless another generated task genuinely gates it.
- The failing command and the relevant failure summary.
- Acceptance criteria that include rerunning the failing command.
- `Suggested skill:` when a specialized skill fits.

Suggested skill mapping:

- Mutation survivors or mutation-threshold failures → `mutation-review`.
- Reproducible failing tests or broken behavior → `diagnosing-bugs` or `tdd`.
- Lint or TypeScript failures → `implement`.
- Fallow health findings → `implement` unless a more specific project skill exists.

After creating quality-failure tasks, stop. Do not implement them in the same cycle; the next `work-spec` cycle should pick up the new frontier.

## Completion

A cycle is complete when exactly one of these is true:

- One frontier task was claimed, implemented, and resolved.
- No frontier task existed, quality failures were converted into ready tasks, and implementation was deferred to the next cycle.
- No frontier task existed and the quality gate passed.
- Work cannot continue because the effort or health base ref is ambiguous, and the user has been asked for the missing decision.
