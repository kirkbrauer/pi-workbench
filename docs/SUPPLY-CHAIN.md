# Dependency threat model — Tier 0

## Enforced controls

- Node 22.23.2 bundles Corepack 0.34.6. Corepack activates pnpm 11.25.0 from an
  exact version **and sha512 package-manager pin**. No global latest pnpm install.
- `pnpm-workspace.yaml` uses isolated resolution, no hoisting, no implicit peer
  installation, strict peer checks, and internal `workspace:*` references only.
  `check:sources` is a dependency-free TypeScript pre-install check using Node's
  type stripping. Direct versions must be exact; no aliases, Git, file or URL
  sources. No real private package names/registry identities belong here.
- Explicit frozen installs, no lifecycle scripts, an empty build approval map,
  no pre/post script execution, and error (not auto-install) on stale dependencies.
- A strict 24-hour release-age quarantine including missing publish timestamps;
  trust downgrade detection; lockfile entries are reverified, not blindly trusted.
  No age/provenance exemptions. Network/metadata failures block installation.
- Lock validation requires sha512-bound registry resolutions and denies alternate
  download URLs. CI checks policy drift with positive/negative fixtures. It runs
  after frozen installation; pnpm performs its own supply-chain verification
  before dependency scripts, and install scripts remain disabled throughout.
- A checkout-local ignored store, integrity/content checks, no side-effect cache,
  no shared credential-bearing CI cache, and a no-credential rootless development
  boundary. Reset the store when its trust context changes; never share work and
  personal stores. Public npm/OCI pulls receive no corporate credentials.

## Updates and vulnerability checks

The initial installed-version baseline was superseded after checking upstream
release metadata: Node 22.23.2 (latest 22 maintenance), pnpm 11.25.0 (latest 11),
Biome 2.5.12, TypeScript 7.0.2, yaml 2.9.0 and current Node-22 type declarations.
Node/Pnpm major upgrades are deliberate compatibility changes, not automatic
moves to registry `latest`. Pi 0.85.1 is temporarily in release-age quarantine.

`pnpm audit --audit-level high` is required in CI, includes dev dependencies and
fails on high/critical advisories or inability to obtain results. Audit is a
revision/time-bound registry observation, not an offline reproducibility claim
or exhaustive malware detection. Never use `audit --fix` to silently rewrite
reviewed pins. `pnpm outdated` is an explicit update investigation command, not
a license to update automatically. No Dependabot write identity is installed.

## Discoveries (not waived)

The first strict install rejected `undici-types@6.21.0`: earlier-published
versions carried stronger provenance. Node 22's current type package still asks
for that version range. We pin `@types/node@22.20.1` and explicitly override only
its `undici-types` edge to attested **6.28.1**, same major, type declarations only.
Review this compatibility change closely; compile/tests validate this toolchain,
not every future consumer of undici types. The provenance gate remains enabled.

The age gate also rejected the same-day Pi 0.85.1 family. The development pin is
**0.85.0**, published 2026-09-04, rather than exempting Pi from quarantine. The
already-running host Pi remains 0.85.1 and is not reinstalled/reloaded. Extension
APIs and model access are not yet qualified for the development pin.

## Residual risks and boundaries

Integrity binds bytes; it is not a malware scan or proof of author trust.
Provenance identifies a build path, not safe behavior. Age delays new attacks,
not old malicious packages. A package may execute when imported or when its CLI
runs despite disabled install scripts. Source and lock/checker changes are
candidate code requiring human review; this is not a tamperproof broker.

Dependency resolution requires network and may disclose public package names.
No private dependency lookup or arbitrary candidate build on a credential-bearing
host is authorized by these settings. PRs run on disposable GitHub-hosted runners
with read-only permissions and no persisted checkout credentials. Do not add
`pull_request_target`, host mounts, a self-hosted workstation runner or an engine
socket to make install/build work. Native VM qualification remains mandatory for
untrusted implementation workers.

Corepack's shim activation on a new host is an explicit toolchain setup step;
never change a shared installation without its owner's authority. The initial
host already has the matching shims. No auth/cache/home directories are copied
into dependency installs. Do not disable TLS verification or add a policy
exception to repair a failed install; investigate and propose a reviewed update.
