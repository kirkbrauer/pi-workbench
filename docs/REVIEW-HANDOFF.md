# Tier 0 review handoff — bundle content verification

## Accepted foundation / current inventory

Development continues on **macOS**. Main at the start of this increment is
`bc9d7a4749a77b0d0ea509faccdbc25597af5837`: native diagnostics (#6), staged formatting
(#7), and workspace-wide ESLint (#8 carried to main by rebased #9) are merged.
The complete merged tree matches reviewed ESLint candidate
`24434f651afa4a5e0fd7fee3cd402a600134d79e`.

[Foundation run 34007347837](https://github.com/kirkbrauer/pi-workbench/actions/runs/34007347837)
passed for #9, checking synthetic merge
`d61f7cf4df62b2a9ed127155464d6727abdafb5e`. Hosted results: 21 JS/TS tests passed,
one real-session hook integration test explicitly skipped; 11 Python tests passed,
one Mac-system-OpenSSL fixture skipped on Linux. The real-session integration and
Mac PKI fixture have separate local evidence; do not count skips as passing tests.
This is prior foundation evidence, not verification of the new bundle code.

Unchanged baseline inputs:

| Input | SHA-256 |
|---|---|
| `config/foundation.json` | `08f73a1569527537fa7a671648122363b2018ab62368896d84eecef4a4d8377c` |
| `pnpm-lock.yaml` | `d24a9852d761c05bd0a7f4ec4fced3c98cd9b65052dc6c05a3c0a2523e84373a` |
| Root `eslint.config.mjs` | `875934e429605dbcd2aebc5ab8c5e52af16ec3863efb3a1bdb4d0044373d12e3` |

## This increment

Branch `feat/t0-bundle-inventory`, based directly on merged main (no open stack base).

- Records Kirk's [accepted runtime limitations](ACCEPTED-RUNTIME-LIMITATIONS.md):
  Landlock unavailable and raw-stop data loss. Original evidence/checks remain intact.
- Refreshes the [board](BOARD.md) and versions accumulated
  [remote bootstrap requirements](REMOTE-BOOTSTRAP.md).
- Introduces `packages/tooling/src/bundle-inventory.ts` and focused synthetic tests.
  It inventories and compares staged bytes/modes against an external expected
  inventory digest/platform, without fetching, extracting, executing or installing.
- Adds `bundle:inventory` / `bundle:verify` root scripts. No dependency, lockfile,
  CI policy, lint rule, runtime configuration or attribution-hook change.

Review [BUNDLE-INVENTORY.md](BUNDLE-INVENTORY.md) for the exact contract and commands.
The inventory's component versions/sources are declarations bound to bytes, not
attestations or dependency-closure proof. The caller must supply an independently
trusted expected digest; computing a digest of untrusted input does not approve it.

## Verification for this candidate

Use the approved pinned toolchain, not the running host Pi/Node installation:

```sh
pnpm check
pnpm audit --audit-level high
pnpm check:hooks
# The normal workspace suite includes the new synthetic inventory tests.
# Optional focused repetition after build:
node --test packages/tooling/dist/tests/bundle-inventory.test.js
```

Candidate SHA, source/configuration digests, exact test outcomes and hosted merge
SHA are attached to the PR after commit. They cannot be self-bound to this file's
own future commit. No new native VM/image or remote runtime was used: image is
**not applicable to these host-side synthetic tests**, not an unknown successful
worker image. Runtime is pinned Node 22.23.2; tests run locally on macOS arm64 and
independently on the hosted Linux runner. New hosted evidence is required before
completion; the earlier #9 run alone is insufficient.

Most important review points:

1. Only operator-owned, stationary, local POSIX staging trees are supported.
   `O_NOFOLLOW` covers the final path component, not hostile parent replacement;
   nonblocking opens reject FIFO substitution without claiming race-free traversal.
2. Exact canonical metadata, size/count/depth/mode/link checks and failure fixtures;
   component/source declarations must not be confused with a trusted release/SBOM.
3. No install/approval/activation or payload execution side effects. Existing native
   acceptance probes and supply-chain checks are not weakened to accommodate this tool.

## Remaining native qualification

Native unmodified OpenShell demonstrated mTLS status/exec, workspace writes and
cooperative checkpoint/restart on Fedora and Mac. Mac stable 0.0.116 and rolling
0.0.117-dev.82+gb9c7d5c70 used tested helper
`bf4a177bb407642b6e452937d687971a36285d96`; exact runtime/image/configuration hashes
remain in [Mac bound evidence](evidence/macos-e2e.txt). Fedora identities remain in
[its bound evidence](evidence/native-spike.txt). These runs were not repeated here.

Landlock absence/raw-stop loss are now accepted limitations, **not passing tests**.
Guest PID enforcement, aggregate Mac host quotas, broad credential/filesystem/
network conformance and actual development userspace in the native VM remain
unqualified. Strict Landlock startup remains unsupported. No real account/provider
enrollment, broker, worker, workflow engine or UI is introduced or admitted.

Host security, workloads and attribution hooks remain unchanged. Native disposable
VMs, overlays, gateways and synthetic PKI/JWT/DB were removed after their runs.
Never transfer `.local/`, auth caches, host HOME, SSH/engine/approval sockets or
synthetic gateway state to Fedora/worker contexts. Preserve unpublished source.

## Next review-sized steps

1. Review/merge this content-checking primitive and scoped decision record; no
   agent merge/enqueue or automatic tier acceptance.
2. Propose a reproducible per-platform bundle builder: exact Node/Pi/Workbench
   inputs, complete runtime dependency/SBOM/native-library closure, validated output
   layout and offline smoke tests under hostile ambient search paths. Nothing is
   downloaded or installed merely by accepting the present metadata schema.
3. Separately review safe extraction/staging, interruption handling, verification
   and activation/rollback on disposable local fixtures. This tool does not secure
   archive extraction or close the verification-to-use race.
4. Only after a concrete approved host/account/profile/key/install plan, consider
   remote seeding. SSH reachability is not enrollment. Durable remote Pi jobs and
   credentialed workers remain later-tier scope with their own review/qualification.
