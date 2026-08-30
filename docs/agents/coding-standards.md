# Coding standards

Load the child whose branch matches the work.

- **result** — `Success` / `Failure` outcomes, result functions, and handled vs unhandled. Load when writing or reviewing a result function, `kind`, `Failure`, or `fromThrowable`. [`results.md`](coding-standards/results.md)
- **port** — I/O Seam: Port and Adapter for every capability that leaves the hexagon. Load when adding or changing a Port, Adapter, Fake, or anything that talks to the world. [`ports.md`](coding-standards/ports.md)
- **assert**, **zod** — Fail-fast invariants, parse unknown, graceful `Failure`. Load when validating input, asserting an invariant, or composing a check at a Seam. [`defensive.md`](coding-standards/defensive.md)
