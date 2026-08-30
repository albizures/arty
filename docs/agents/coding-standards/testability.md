# Testability

Testability is a design standard: important behavior should be observable through a small public seam, not through broad mocks, private-method reach-in, or incidental framework behavior.

## Refactoring rules

- Put domain decisions in pure functions or small classes whose dependencies are constructor arguments.
- Move I/O behind Ports. Port and Adapter rules live in [`ports.md`](ports.md).
- Use Fakes for domain tests. Mocking a module that crosses I/O usually means the seam is in the wrong place.
- Extract a named result function when behavior has meaningful outcomes. Result rules live in [`results.md`](results.md).
- Keep framework, runtime, network, time, filesystem, and environment access at the composition edge or in Adapters.
- Prefer asserting observable outcomes over implementation steps. A test that breaks after harmless refactoring is too coupled.
- If coverage is hard to reach, first ask whether the code mixes decision logic with I/O, time, randomness, or framework lifecycle.
- If mutants survive, either add a test that names the missing behavior or delete/simplify the behavior if it is not required.

## Check

A testability refactor is done when:

- [ ] The behavior under test can be exercised without real I/O, real time, network access, or process-global mutation.
- [ ] Tests use the public module seam: exported functions/classes, Ports, or composition entry points.
- [ ] Domain tests depend on Ports and Fakes, not production Adapters.
- [ ] Coverage gaps correspond to intentionally excluded code, not unreachable design.
- [ ] Surviving mutants have been killed by behavior tests or removed with the unnecessary code.
