# Coding standards

Load the child whose branch matches the work.

- **quality**, **lint**, **typecheck**, **coverage**, **mutation**, **CRAP**, **health** — Tool-backed quality standards and command usage. Load when changing quality tooling, scripts, or deciding which quality check applies. [`quality.md`](coding-standards/quality.md)
- **testability**, **refactor** — Refactoring code so behavior is testable without broad mocks or brittle setup. Load when code is hard to cover, hard to mutate-test, or needs a testing seam. [`testability.md`](coding-standards/testability.md)
- **result** — `Success` / `Failure` outcomes, result functions, and handled vs unhandled. Load when writing or reviewing a result function, `kind`, `Failure`, or `fromThrowable`. [`results.md`](coding-standards/results.md)
- **port** — I/O Seam: Port and Adapter for every capability that leaves the hexagon. Load when adding or changing a Port, Adapter, Fake, or anything that talks to the world. [`ports.md`](coding-standards/ports.md)
- **assert**, **zod** — Fail-fast invariants, parse unknown, graceful `Failure`. Load when validating input, asserting an invariant, or composing a check at a Seam. [`defensive.md`](coding-standards/defensive.md)
