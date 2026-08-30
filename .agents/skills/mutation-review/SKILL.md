---
name: mutation-review
description: Run Stryker on a file or glob, triage surviving mutants, and fix what earns it.
---

User supplies a **target**: one file or a glob (e.g. `src/adapters/issue-tracker/github/github.adapter.ts`, `src/adapters/**/*.adapter.ts`). Default to the whole target they named; don't widen scope.

## Run

```bash
pnpm mutation --mutate "<target>"
```

Run it with normal project shell access. If the harness has explicit sandbox permissions, request unsandboxed execution. Stryker's checker teardown calls `process.kill`, which some sandboxed shells deny: the run completes and prints its report, then exits 1 with `kill EACCES`. Don't treat that as a failing run, and don't switch to a different runner.

**Done when:** the command finishes (pass or fail). Capture stdout; open `reports/mutation/mutation.html` only if stdout is truncated or a survivor's line context is unclear.

## Triage every survivor

Each **survivor** is a mutant tests didn't kill. Classify it into exactly one bucket:

| Bucket | Leading word | When |
|--------|--------------|------|
| Test gap | **kill** | Removing or changing this line would break observable behavior callers rely on, and a focused test at an existing seam can prove it — without coupling to implementation detail. |
| Noise | **ignore** | The mutant touches literals, messages, or wiring that isn't behavior under test (assert second args, log text, HTTP header strings when fetch is fully mocked). Recurring patterns → extend a plugin under `test/plugins/`. One-offs → `// stryker disable` only when a plugin rule would be too broad. |
| Code smell | **fix** | The survivor exposes redundant, unreachable, or wrongly generalized code — both `if (true)` and `if (false)` survive, duplicate error paths, validation the domain already guarantees elsewhere. |

When unsure between **kill** and **ignore**, read the tests that ran (listed on the survivor). If they only assert result *kind* and never the path that produces it, lean **kill** for conditionals and early returns; lean **ignore** for string payloads inside errors.

When unsure between **kill** and **fix**, ask: would a test documenting current behavior cement a bug? If yes, **fix** first.

## Report

One section per bucket, ordered **fix → kill → ignore** (code changes before test work before tooling). For each survivor:

- Location (`file:line`, mutant type)
- One sentence: what changed and why tests still pass
- Recommended action (test name/seam, plugin rule sketch, or code change)

End with mutation score and a one-line plan: counts per bucket and whether to implement now or stop at the report.

## Fix (only when asked)

Implement in bucket order. After each batch:

```bash
pnpm mutation --mutate "<target>"
```

Re-triage new survivors. **Done when:** the user asked for is implemented and mutation score moved, or remaining survivors are documented **ignore** candidates they chose to defer.
