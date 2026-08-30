# Ports

A **port** is the Interface at an I/O Seam: an abstract class for one **capability** that swaps as a unit. Read `.agents/skills/codebase-design/SKILL.md` for Interface, Seam, Adapter, and Depth before this file. This doc does not redefine Adapter.

In-process Seams wait for a second production Adapter. I/O Seams exist because the other side is the world (time, network, disk, Node) — one production Adapter is enough. Tests often supply a Fake; they are not the justification.

Reference implementation: `src/domain/ports/timers.port.ts`, `src/adapters/timers/native.adapter.ts`, `test/fakes/fake-timers.ts`.

## Files and names

| Role                  | Path                                                                   | Class                                                         |
| --------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------- |
| Port                  | `src/domain/ports/<capability>.port.ts`                                | Capability (`Timers`) — no `Port` suffix                      |
| Adapter (single-file) | `src/adapters/<capability>/<source>.adapter.ts`                        | `<Source><Capability>` (`NativeTimers`) — no `Adapter` suffix |
| Adapter (multi-file)  | `src/adapters/<capability>/<source>/<source>.adapter.ts` plus siblings | same class rule; entry keeps the `*.adapter.ts` suffix        |

`<capability>` is the Port file stem (`timers`, `issue-tracker`). **Source** is the thing across the Seam: runtime (`native`), package (`stripe`), or HTTP system (`github`, `fetch`). Ports cover all three. One Port per file. Import the entry file; there is no barrel `index.ts`.

**Promotion**: a second production file for that Source+Port turns the single-file Adapter into a folder of the same stem. Helpers that exist only to serve that Adapter live beside the entry (composition root may import them; domain may not). Do not invent a top-level `adapters/<source>/` kit until a second Port shares the helper.

Worked example — `IssueTracker`:

```
src/adapters/issue-tracker/
  in-memory.adapter.ts              # single-file (InMemoryIssues)
  github/
    github.adapter.ts               # multi-file entry (GitHubIssues)
    auth.ts                         # Source helper for this Adapter
```

A Port is one capability, not one Node builtin. "Every external API gets a Port" means every capability that leaves the hexagon.

## Returns

Port methods return a named `Success`/`Failure` union — the result. Shape and result-function rules: [`results.md`](results.md). Sync and async may mix on one Port (`TResult` vs `Promise<TResult>`).

`fromThrowable` / `fromSyncThrowable` stay Adapter-side for I/O classification. Class methods only call local result functions with explicit return types. Callers never see a wrapper type at the seam.

No payload is `{ kind, data: undefined }` (`data` is always present). `void` belongs on a **handle** the Port already returned (`Timer.start` / `stop`). Reaching for `void` on a Port method means it belongs on a handle, or it is an awaitable completion you failed to name.

## Who calls the world

Domain never crosses I/O and never imports `src/adapters/`. Domain classes take the abstract Port in the constructor; only a composition root or test constructs the Adapter.

An Adapter may call **only the Source it is named for**. Any other capability is injected as a Port (e.g. `StripePayments` takes `Timers` for retries). Extract a transport Port when that transport becomes its own swapping capability or duplication forces it — not under every remote API.

## Tests

Domain tests depend on the Port type and inject a Fake that **extends** it. Fakes live flat under `test/fakes/fake-<capability>.ts` (`FakeTimers`, `FakeIssueTracker`) — one Fake per Port, not per Source. Production Adapters are not the domain test double.

Unit tests that exercise an Adapter mirror its path under `test/unit/adapters/` (capability folder; Source subfolder when the Adapter is multi-file).

Tests type the collaborator as the Port and never import Adapter-local result functions. `jest.mock` of a Port is the wrong seam.

## Check

A Port/Adapter pair is done when:

- [ ] Paths and class names match the table; one Port per file; multi-file Adapters use a Source folder with a `*.adapter.ts` entry.
- [ ] Every Port method returns a named result union (`data` present); handles may be `void`.
- [ ] Adapter class methods only call local result functions; `{ kind, data }` literals live in those functions.
- [ ] Domain depends on the Port type; tests inject a `test/fakes/fake-<capability>.ts` Fake that extends it.
- [ ] Adapter unit tests mirror `src/adapters/<capability>/…` under `test/unit/adapters/`.
