# Tier 0 review handoff — locked bundle dependency plan

## Accepted base

Development continues on **macOS**. Kirk merged inventory-verifier PR #10 on
2026-09-06 as `5e679feb1ae417e511d673728e27d52968539e10`. This increment starts there
on `feat/t0-bundle-dependency-plan`, not on an unmerged stack.

Prior [Foundation run 34009626908](https://github.com/kirkbrauer/pi-workbench/actions/runs/34009626908)
passed for candidate `6c37e0ce4c333b6f3ed3c7093e6483be5a0528e9`, synthetic merge
`2f2498be061184a080ba5df20d8ce8184b50e78e`. Runner image: ubuntu-24.04,
20260831.293.1; Node 22.23.2. JS/TS: 36 passed, one actual-session hook integration
skip. Python: 11 passed, one Mac-system-OpenSSL skip. This is baseline evidence,
not validation of the new planner. Native diagnostics, formatting and ESLint were
already merged; see [BOARD.md](BOARD.md).

Unchanged input identities:

| Input | SHA-256 |
|---|---|
| `config/foundation.json` | `08f73a1569527537fa7a671648122363b2018ab62368896d84eecef4a4d8377c` |
| `pnpm-lock.yaml` | `d24a9852d761c05bd0a7f4ec4fced3c98cd9b65052dc6c05a3c0a2523e84373a` |
| Root `eslint.config.mjs` | `875934e429605dbcd2aebc5ab8c5e52af16ec3863efb3a1bdb4d0044373d12e3` |

## This increment

- `packages/tooling/src/bundle-plan.ts`: offline lock-graph projection for an
  explicit Pi + declared foundation-tooling dependency seed profile.
- `packages/tooling/tests/bundle-plan.test.ts`: 13 focused tests, including actual
  locked platform payloads, required/optional/peer failures and resource budgets.
- `bundle:plan` root command and [BUNDLE-PLAN.md](BUNDLE-PLAN.md) usage/contract.
- Exposes/reuses the inventory verifier's existing bounded metadata reader. Its
  file checks and inventory format are unchanged; existing tests remain intact.
- No dependency/lock change, downloader, artifact unpacking, native binary execution,
  remote installer, runtime policy, CI rule or attribution-hook change.

The actual graph contains platform esbuild and clipboard packages, and explicitly
unbound optional peers. Darwin retains both compatible clipboard variants; it is
not safe to prune one by filename intuition. A graph with 129 Darwin/128 Linux
snapshots is **not** a complete runtime SBOM. Node archive identity, tarball bytes,
manifests/licenses, bundled dependency contents, helper/native libraries and exact
OS baselines still need verification. Existing checkout-oriented development tools
also require deliberate entrypoint selection before calling anything standalone.

## Review focus

1. Peer-context identity and graph traversal: required edges cannot be dropped;
   compatible optionals are retained; incompatible optional edges remain visible;
   no ambient or registry resolution repairs missing entries.
2. Scope of evidence: SRI and URLs identify declared inputs, not inspected bytes or
   publisher trust. Peer/engine ranges and context-to-binding semantics remain
   unvalidated. The plan's caller-supplied source SHA is not a Git attestation.
3. Failure/limit behavior: duplicate/aliased/tagged YAML, unsupported resolution
   forms/fields, unsafe identities, missing nodes and metadata amplification fail.
   This is ordinary host tooling for trusted stationary inputs, not a broker or
   hostile-filesystem boundary. No check was relaxed for the new code.

## Candidate verification

Use the already approved pinned Node 22.23.2 / Corepack 0.34.6 / pnpm 11.25.0:

```sh
pnpm check
pnpm audit --audit-level high
pnpm check:hooks
node --test packages/tooling/dist/tests/bundle-plan.test.js
# Read-only plans; supply the actual source SHA and new intended output paths:
pnpm --silent bundle:plan darwin-arm64 SOURCE_SHA > NEW_MAC_PLAN.json
pnpm --silent bundle:plan linux-x64-gnu SOURCE_SHA > NEW_LINUX_PLAN.json
```

Exact committed SHA, input/source/output digests, local outcomes and fresh hosted
merge/image identities are attached to the PR after commit. Earlier #10 CI does
not validate this increment. No worker VM/image is applicable to these host-side
synthetic/metadata tests. Cross-target planning on macOS is not a Linux runtime
smoke test. Hosted Linux repeats the tool's tests, not a packaged Pi launch.

## Remaining gates / next steps

[Accepted runtime limitations](ACCEPTED-RUNTIME-LIMITATIONS.md) remain scoped:
Landlock absence and raw-stop loss are observed failures accepted by Kirk, not
passing tests. Guest PID controls, aggregate Mac host quotas and broad credential/
filesystem/network qualification remain unresolved. No untrusted worker is admitted.
Native helper `bf4a177bb407642b6e452937d687971a36285d96` and exact runtime/image/config
identities remain in [Mac evidence](evidence/macos-e2e.txt) and
[Fedora evidence](evidence/native-spike.txt); these runs were not repeated here.

After review/merge, collect/verify exact archive bytes and package metadata, then
implement reproducible materialization/assembly and offline no-model runtime tests.
Do not mistake inspected installed packages for SRI-verified source archives or a
successful planner for a ready release. Safe extraction, activation/rollback and
real host/account/key enrollment remain separately reviewed increments under
[REMOTE-BOOTSTRAP.md](REMOTE-BOOTSTRAP.md). Preserve host tools, workloads, hooks,
credentials and unpublished source. No agent merge/enqueue or inferred tier acceptance.
