# Workspace-wide ESLint and Biome formatting

All lint rules, file selection and ignores live in **root `eslint.config.mjs`**.
Root commands cover the workspace, including new packages and their tests:

```sh
pnpm lint                     # ESLint; warnings also fail
pnpm lint:fix                 # explicit fixes; review the resulting diff
pnpm format                   # Biome formatting
pnpm format:check             # formatting/import-organization verification
pnpm check                    # both checks + typecheck/build/test/toolchain/policy
```

Use pinned pnpm through Corepack, not an ambient/global ESLint or npm install.
If Biome reports import-organization changes, use `pnpm exec biome check --write .`
explicitly and review the diff. Neither fix command stages files automatically.

## Policy

- `@eslint/js` recommended rules for JS and TS source.
- `typescript-eslint` recommended rules for TypeScript. These are syntax-aware
  checks; strict compiler checking remains separate. This increment does not
  claim the additional coverage of type-aware ESLint presets.
- `@stylistic/padding-line-between-statements`: blank lines before and after
  interface, type, function, class, enum and export declarations. This addresses
  declaration spacing that Biome preserves but cannot insert by itself.
- Node globals for this Node-based tooling repository. A future browser package
  needs a reviewed environment override, not blanket browser globals everywhere.
- Exclude dependency, generated/build, coverage, `.git`, `.local` and private `.pi`
  trees. Do not exclude failing source/tests to pass a check.
- `--max-warnings 0`; no per-rule suppressions added to hide findings. Biome's
  previous `preset: none` lint configuration is replaced by ESLint, while Biome
  formatting/import organization stays enabled. Its linter is disabled to avoid
  maintaining competing semantic configurations.

The commit hook remains formatting-only and preserves partially staged work;
`pnpm check` and hosted CI run the workspace lint gate. See
[FORMATTING-HOOKS.md](FORMATTING-HOOKS.md).

## Pins and parser compatibility

| Component | Exact version | Location |
|---|---|---|
| ESLint | 10.10.0 | Root dev dependency |
| `@eslint/js` | 10.0.1 | Root dev dependency |
| `@stylistic/eslint-plugin` | 5.10.0 | Root dev dependency |
| `globals` | 17.12.0 | Root dev dependency |
| Biome | 2.5.12 | Root dev dependency, unchanged |
| TypeScript compiler | 7.0.2 | Root dev dependency, unchanged |
| `typescript-eslint` | 8.69.0 | Private parser compatibility workspace |
| TypeScript parser dependency | 6.0.3 | Private parser compatibility workspace |

Current `typescript-eslint` declares TypeScript `>=4.8.4 <6.1.0`. It therefore cannot
share the root 7.0.2 dependency under our strict peer policy. The tiny
`packages/eslint-typescript` workspace exports the supported parser/configuration
library with its own exact 6.0.3 dependency; **it owns no lint policy**. ESLint itself
and its CLI/plugins stay at the root. Even this workspace's JS/type checks invoke
the root 7.0.2 compiler explicitly. No compiler downgrade or unsupported-peer waiver.

Tests verify the distinct installed compiler/parser resolutions. Future TypeScript
syntax beyond the parser's support is a compatibility blocker, not a reason to
suppress parsing errors. Reassess this isolation when upstream supports our compiler.

All new dependencies were resolved under the existing exact-source, strict-peer,
24-hour quarantine, trust/no-downgrade and integrity policies, without lifecycle
scripts or new exceptions. The lock gains 87 entries (279 total); existing locked
entries are preserved. These are development tools, not an assertion that every
one belongs in a future remote runtime bundle.

## Regression evidence

Five tests load the actual root config and check:

1. Missing declaration spacing fails, correct spacing passes.
2. Recommended JS/TS rules catch debugger/undefined names/unused variables/explicit
   `any`, checking specific rule IDs rather than accepting an unrelated failure.
3. Spacing fixes are idempotent and retained by the pinned Biome formatter.
4. One policy covers package source/tests while private/generated paths are ignored.
5. Parser isolation preserves the exact root compiler and supported parser versions.

Tests use synthetic source text with no model, SSH, credentials or VM execution.
Hosted evidence is attached to the exact PR candidate; local checks that also see
unfinished bundle source must not be mistaken for a test of published bundle software.
