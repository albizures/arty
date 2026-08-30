# Results

A **result function** is any function in `src/` with an explicit return type that is a named `Success` or `Failure` union. Types and helpers live in `src/domain/result.ts`.

## Handled vs unhandled

- **handled**: a `Failure` with a named `kind`. No throw. Expected is the same word.
- **unhandled**: a throw, caught as `unknown`. Unexpected is the same word.

Result functions model handled outcomes. A result function may still throw (`assert`, a Source API, rethrow of unhandled). Port methods and domain result functions return `Failure` for every anticipated mode.

## Kind names the outcome

`Success` and `Failure` are **categories**. `kind` names the **outcome** (`created`, `elapsed`, `timed-out`, `invalid-env`).

Each result function exports a named union of its concrete variants. Kinds are string literals, unique across that union: a `kind` tells you the variant and the category. Callers branch on `kind`. A Success-only union is the shape when there is no anticipated failure; unhandled can still throw.

- `Success`: `{ kind, data }` — no `error` field.
- `Failure`: `{ kind, data, error? }` — `error` only when the mode started as a throw you classified. zod and business-rule failures omit it.
- `data` is always present. Carry `undefined` when there is nothing else.

`kind` is never `'success'` or `'failure'`.

## Classification

At `fromThrowable` / `fromSyncThrowable` `mapResult` (or an equivalent `catch`):

- This result function's union names a `kind` for that mode → return `Failure`. Wrap a non-`Error` as `Error` onto `Failure.error`.
- No named `kind` for that mode → rethrow the original value.
- `assert` failures stay throws. Mapping them into `Failure` is a bug. (`assert` itself: [`defensive.md`](defensive.md).)

Name every anticipated mode. Catch-all kinds (`'unknown'`, `'error'`, …) hide unhandled as handled.

`test/unit/domain/result.test.ts` is the classification example: named `Failure` vs rethrow of the original value; wrap non-`Error` as `Error`; a throw from `mapResult` on the success path is not swallowed.

## Helpers

- Every result function has an **explicit return type** naming its `Success`/`Failure` union. That return type carries the union; do not sprinkle `satisfies` or type arguments on every `success`/`failure` call.
- Construct every Result-shaped value with `success(kind, data)` or `failure(kind, data, error?)` — in `src/` and in tests (including `toEqual`). Do not hand-roll `{ kind, data }` literals. Do not add per-file leaf factories (`issueCreated`, `authFailed`, …) or one-line remappers that only rename a `return failure(...)`.
- `success` / `failure` are value constructors for the **categories**; they are not `kind` names. Pass `data` always (including `undefined`). Pass the third argument to `failure` only for a classified throw — omitting it leaves the `error` property absent.
- Keep helpers that transform non-Result input (Zod issues, Octokit errors, parse pipelines). Those end in `success` / `failure`.
- `fromThrowable` / `fromSyncThrowable` wrap the **smallest throwing call** (the Node or third-party function), not the result function body. `assert` and zod/business checks sit outside that wrap so they never land in `mapResult`. Use at adapter I/O boundaries; domain result functions return `success` / `failure` directly.
- An existing `Promise` is `fromThrowable(() => promise, mapResult)`.

Adapter-only composition (assert → `fromThrowable` → `safeParse`): [`ports.md`](ports.md), [`defensive.md`](defensive.md).

Shapes that are not `Success` / `Failure` (for example InvalidArgv with `message` / `json`) stay outside these helpers.

## Check

A result function is done when:

- [ ] It has an explicit return type that is a named `Success`/`Failure` union; every `kind` names an outcome, not a category.
- [ ] Every Result-shaped value is built with `success` / `failure`; no leaf factories or hand-rolled `{ kind, data }` literals.
- [ ] Anticipated modes return `Failure`; anything else rethrows the original value.
- [ ] `fromThrowable` wraps only the throwing call; `mapResult` classifies.
- [ ] Every variant has `data`; `error` appears only on classified throws.
