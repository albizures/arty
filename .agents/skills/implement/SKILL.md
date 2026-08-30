---
name: implement
description: "Implement a piece of work based on a spec or set of tickets."
disable-model-invocation: true
---

Implement the work described by the user in the spec or tickets.

Use /tdd where possible, at pre-agreed seams.

Read `docs/agents/coding-standards/quality.md`; it is the source of truth for quality commands, thresholds, and scope. During implementation, run focused checks regularly: `pnpm typecheck` after type-shape changes, relevant single test files while changing behavior, and `pnpm lint` after code cleanup.

Before declaring the work done, run the applicable quality gate from `docs/agents/coding-standards/quality.md`: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm mutation`, and `pnpm health -- <base-ref>` when the comparison base is known. If the base ref is not known, ask for it rather than guessing.

Once done, use /code-review to review the work.

Commit your work to the current branch.

