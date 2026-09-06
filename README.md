# Pi Workbench

A **TypeScript monorepo** for composable Pi engineering tools with a separately
trusted execution broker. **Focused Tier 1 is authorized; the local registry/CLI
is merged, with typed ORM/migrations under review. No worker, UI or execution broker yet.**
**Native OpenShell MicroVM diagnostic execution works on both Fedora Linux
(x86_64/KVM) and macOS (Apple Silicon/Hypervisor.framework).** Authenticated exec,
workspace writes and cooperative checkpoint/restart are demonstrated with
synthetic data. **Landlock absence and raw-stop data loss are accepted limitations**;
see the [scoped decision](docs/ACCEPTED-RUNTIME-LIMITATIONS.md). Guest PID limits and
broader worker-boundary qualification remain unresolved; no untrusted worker is admitted.

See [Fedora evidence](docs/NATIVE-RUNTIME-SPIKE.md),
[macOS E2E evidence](docs/MACOS-E2E.md), and the
[prepared Fedora handoff](docs/FEDORA-HANDOFF.md).
**Current development continues on macOS**; the Fedora handoff is a future reference.

## Setup (trusted foundation checkout)

Pinned development toolchain: Node **22.23.2**, its bundled Corepack **0.34.6**,
pnpm **11.25.0** (version + integrity), upstream Pi **0.85.0**. The running host
Pi is not reinstalled/reloaded. See [supply-chain policy](docs/SUPPLY-CHAIN.md)
for version selection, release quarantine and residual risks.

On an approved host/image with this Node distribution:

```sh
corepack --version                 # must be 0.34.6
corepack enable pnpm               # explicit setup; do not overwrite unrelated shims
corepack install                   # activates the packageManager integrity pin
node --experimental-strip-types packages/tooling/src/sources.ts
pnpm install --frozen-lockfile --ignore-scripts
pnpm check
pnpm audit --audit-level high
pnpm check:hooks
# From the actual agent session, with its identity/policy environment intact:
pnpm test:hooks
```

Dependency installation and execution belong in an approved development boundary.
No auth directories or host sockets are needed. New hosts must explicitly install
the pinned Node distribution; this repository does not upgrade host tools.

`pnpm check` runs Biome formatting checks, workspace-wide ESLint recommended
JavaScript/TypeScript rules and declaration spacing, strict TypeScript checking,
workspace compilation/tests, exact tool versions and dependency source/policy checks.
All lint policy lives in root `eslint.config.mjs`; see [LINTING.md](docs/LINTING.md).
`pnpm build`, `pnpm typecheck` and `pnpm test` traverse workspaces. Every workspace
must provide those scripts. `pnpm lint:fix` applies ESLint fixes and `pnpm format` applies formatting; `pnpm outdated`
investigates updates without changing the lock. Audit includes dev dependencies.
[Post-turn checks](docs/POST-TURN-CHECKS.md) proposes an opt-in Pi extension for scoped,
automatic development feedback; it is not installed or active yet.

For the bounded rootless helper and immutable development image, see
[DEVELOPMENT-IMAGE.md](docs/DEVELOPMENT-IMAGE.md). Registry/Curation profiles and
corporate CA qualification are in [REGISTRIES-AND-CA.md](docs/REGISTRIES-AND-CA.md).
The native VM **ran but failed qualification**; see [NATIVE-VM.md](docs/NATIVE-VM.md).

## Attribution

Preserve installed `git-attribution-hooks`, not Husky or a new repo hooksPath.
`pnpm check:hooks` checks executable contents against the inspected upstream pin.
`pnpm test:hooks` exercises attributed commit/push and two intentional denials in
a disposable local repository/bare remote, preserving actual identity, session
and policy. No fixtures are published to GitHub. Human-certification policies or
unexpected hook refusals must be handed back, never overridden to pass a test.

For staged-code formatting, explicitly run `pnpm install:format-hook` using the
approved host-native pinned Node. It chains a repository-local check through the
existing attribution hook without changing `core.hooksPath` or upstream hooks.
It checks index blobs and never restages partially staged work. See
[FORMATTING-HOOKS.md](docs/FORMATTING-HOOKS.md); run `pnpm test:format-hook` in the
actual agent session to exercise formatting plus attribution together.

For a fresh host without hooks, inspect and use upstream's supported installer:

```sh
git clone https://github.com/kirkbrauer/git-attribution-hooks.git /your/trusted/hooks-source
git -C /your/trusted/hooks-source checkout 4b7d05eff74e56a7277cbbb22ac77ad4247bc43b
# Human-owned global setup; inspect first. Do not use --force.
/your/trusted/hooks-source/install.sh --copy
```

Then build and run hook checks. No installer runs automatically; Git identity is
never overwritten. Actual Pi session metadata supplies attribution to Pi, not an
invented Codex co-author. The hooks supply DCO under the installed policy; neither
DCO nor agent-created PRs certify Kirk's review.

## Local Work/Workspace CLI

The local product slice tracks objectives, adopts existing Git worktrees, persists
an explicit workspace selection, and rejects stale context or checkout drift.
See **[packages/core/README.md](packages/core/README.md)** for setup and examples:

```sh
pnpm build
pnpm --silent workbench --help
```

An opt-in [Workbench skill](skills/workbench/SKILL.md) teaches Pi agents the CLI
workflow; it is not installed into global Pi configuration. [Pi ecosystem choices](docs/PI-ECOSYSTEM.md)
records the inspected upstream tools and where Workbench deliberately differs.
[Work and resumption](docs/WORK-AND-RESUMPTION.md) describes the morning work view,
internal goals/tasks/threads, optional multi-repo checkout sets and private XDG storage.
[State portability](docs/STATE-PORTABILITY.md) separates local schema upgrades from
future logical Git backups, machine transfers and JJ/Gerrit review identities.
The registry uses Drizzle's typed SQLite schema and versioned migrations; the CLI
keeps its XDG locations and JSON contract. This local metadata slice grants no
execution authority. Bundle assembly is deferred,
not a prerequisite to the local product loop.

## Layout

- `packages/core/`: local registry, Git checkout observations and Commander CLI.
- `skills/workbench/`: task-oriented agent guidance for the CLI.
- `packages/tooling/src`, `packages/tooling/tests`: real TypeScript foundation tools,
  including an [offline bundle inventory verifier](docs/BUNDLE-INVENTORY.md) and
  [locked dependency planner](docs/BUNDLE-PLAN.md). Bundle assembly is not implemented.
- [Remote bootstrap requirements](docs/REMOTE-BOOTSTRAP.md): explicit enrollment,
  self-contained artifacts and bounded update authority; no remote installer yet.
- `pnpm-workspace.yaml`, `pnpm-lock.yaml`: workspace and supply-chain policy/lock.
- Root `tsconfig.json`: shared strict compiler options; package-local build output.
- `config/`: public exact tool/hook inputs, no credentials.
- `.github/workflows/checks.yml`: hosted read-only PR/merge-group checks and audit.
- `docs/design/`: imported versioned architecture/hand-off baseline, not an engine.
- `docs/BOARD.md`, `docs/REVIEW-HANDOFF.md`: current scope, evidence and blockers.

Following DESIGN §12, introduce core, policy, execd, workspace and thin Pi packages
as their tiers introduce behavior, not dozens of empty packages. Broker security
remains separate from extension packaging. Private company/personal config stays
outside this repository. Mockup assets are simulated and are not implementation.

## Recovery and review

Retain source/unpublished changes. Recreate ignored dependency/build output using
the exact frozen install/build commands. A potentially contaminated `.local`
dependency store must not be reused across trust domains. Investigate failed
supply-chain checks; never suppress them to install. Inspect hook drift rather
than replacing/bypassing hooks. Do not remove existing host workloads/tools.

See [forge constraints](docs/FORGE.md). The personal-owner repo cannot use GitHub
merge queues. The workflow is queue-compatible, not queue-tested. Stop at Kirk's
GitHub review gate. Kirk authorized focused Tier 1 on the merged foundation;
remaining worker-qualification gaps stay attached to enabling real execution.
