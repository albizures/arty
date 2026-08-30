# Quality tooling

Quality is tool-backed. The configured files are the source of truth for thresholds and scope.

## Commands

| Standard               | Command                     | Source of truth       |
| ---------------------- | --------------------------- | --------------------- |
| ESLint                 | `pnpm lint`                 | `eslint.config.js`    |
| TypeScript             | `pnpm typecheck`            | `tsconfig.json`       |
| Coverage + CRAP        | `pnpm test`                 | `vitest.config.ts`    |
| Mutation testing       | `pnpm mutation`             | `stryker.config.json` |
| Fallow health audit    | `pnpm health -- <base-ref>` | `.fallowrc.json`      |
| Fallow exploratory CLI | `pnpm fallow <command>`     | `.fallowrc.json`      |

`pnpm health` intentionally requires an explicit base ref. Example: `pnpm health -- main`.

## Standards

- ESLint errors are code-quality failures. Disable comments must be narrow and explain why the rule is wrong for that line.
- TypeScript errors are code-quality failures. Do not bypass the type system with `any`, broad casts, or non-null assertions when a narrower type or earlier validation would express the invariant.
- Tests run with coverage. Coverage thresholds are configured in `vitest.config.ts` and apply to included production source.
- CRAP is part of the Vitest setup through `@barney-media/crap-typescript-vitest`. The configured threshold is authoritative.
- Mutation testing uses Stryker. Surviving mutants are evidence that behavior is unspecified or code is unnecessary.
- Fallow health findings are design feedback: dead code, duplication, dependency hygiene, complexity, and related structural risks.

## Check

Quality tooling is satisfied when:

- [ ] `pnpm lint` reports no violations.
- [ ] `pnpm typecheck` reports no violations.
- [ ] `pnpm test` passes with configured coverage and CRAP thresholds.
- [ ] `pnpm mutation` passes the configured mutation thresholds.
- [ ] `pnpm health -- <base-ref>` passes for the intended comparison base.
- [ ] Any suppression, ignore, exclusion, or threshold change is deliberate and documented beside the config change.
