# Assert and zod

**assert** fails fast on invariants our types already promised. **zod** parses `unknown` that crossed an I/O Seam. A schema miss is a named `Failure`.

`assert` lives in `src/utils/errors.ts`. Outcome shape and `fromThrowable` wrap-scope: [`results.md`](results.md). NativeTimers is the assert-only reference (`src/adapters/timers/native.adapter.ts`); it has no zod and no anticipated `Failure`.

## Jobs

- **zod** (`safeParse` only): driven Source payloads and driving I/O (env, argv, inbound HTTP, files). Domain does not import `zod`.
- **assert**: Port method inputs and in-hexagon calls — invariants TypeScript cannot express (non-negative duration). A JS caller violating published types is the same case.

zod encodes what the world can send. `assert` encodes a promise our code already made.

## Failed check

`assert` when our code broke a promise it already made (unhandled). Named `Failure` when the world or operator can do this.

- `timers.wait({ timeout: -1 })` → `assert`. `Timers` has no `'invalid-timeout'` until a later capability needs a handled mode.
- Source body fails the schema → `Failure` `'invalid-response'`.
- Missing required env → `Failure` `'invalid-env'` from a composition-root result function (CLI prints and exits).

## Schema-miss Failure

Each result function names `invalid-<noun>` (`invalid-env`, `invalid-argv`, `invalid-body`, `invalid-response`).

`data` is `{ issues: { path: (string | number)[]; message: string }[] }`, mapped from `error.issues`. Path and message only. Alias the issues shape on the Port file if named; not on `result.ts`. No `error` field, no raw input, no `ZodError` on the Port.

## Types

Port (or composition-root result function) types are handwritten and are the source of truth. The schema is `z.ZodType<ThatType>` in the Adapter. No `z.infer` under `src/domain/`.

## Driven Adapter order

1. `assert` on the typed Port input.
2. Inner `fromThrowable` around the **single** Source call. `mapResult` classifies named throws into `Failure` (with `error`) or rethrows (`results.md`). Success of that inner result function is Adapter-local (`received` + unknown `data`) — not a Port kind.
3. Outer result function: if inner returned a `Failure`, return it.
4. `safeParse` the received payload.
5. Schema miss → `invalid-response` `Failure`.
6. `assert` only for contradictions that mean **our** code is wrong after a successful parse (the world cannot produce them; if it can, they belong in the schema).
7. Port `Success`.

The Adapter class method calls **only** the outer result function. World-producible constraints live in the schema.

## Driving I/O (env/argv)

`safeParse(process.env)` (or argv) → `invalid-env` / `invalid-argv` or `loaded`. Same `assert` rule around it. No `fromThrowable`.

## How it is written

Inline `safeParse` in the result function. Schema `const` in that same Adapter file (env/argv schema in the composition-root module). Sibling `*.schema.ts` only when a second Adapter shares the wire format.

Both `devDependencies` and `peerDependencies` list `zod` at `^4`.

## Check

A boundary is done when:

- [ ] `unknown` from I/O is `safeParse`d; Port inputs and in-hexagon invariants are `assert`ed.
- [ ] Schema miss is `invalid-<noun>` with `{ issues }` on `data`; `assert` failures stay throws.
- [ ] Driven Adapters follow assert → `fromThrowable` → `safeParse` → Port result; class methods call only the outer result function.
- [ ] Domain types are handwritten; the schema lives in the Adapter and is `z.ZodType<ThatType>`.
