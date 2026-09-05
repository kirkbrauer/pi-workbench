# Pi Workbench

Composable Pi engineering tools with a separately trusted execution broker.
**Tier 0 in progress; no worker, UI or broker is implemented.** Native Fedora
OpenShell MicroVM execution is not verified. The HTML handoff mockup is simulated.

## Setup (trusted foundation checkout)

Initial toolchain: Linux amd64, Node **22.20.0**, bundled npm **10.9.3**, upstream
Pi **0.85.1**. Pins are an initial compatibility baseline, not a claim these are
latest releases. Do not update the host's running Pi installation.

With the pinned Node/npm already installed:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run check
npm run check:hooks
# In a real agent session, preserving its attribution environment:
npm run test:hooks
```

Install dependencies only in an approved development boundary; install scripts
are disabled. `npm run check` checks exact tools, Biome formatting/lint, strict
TypeScript checking, compilation of the actual tooling workspace, and focused
behavior tests. `npm run build` builds every workspace; `npm test` builds then
runs every workspace's tests. There is no application build or placeholder suite. `npm run format` applies formatting. No extension is installed or
loaded into the current Pi instance. Local Pi is pinned as a dependency for
later isolated API probes, not an activated worker.

## Attribution

Existing hooks are preserved, not replaced with Husky or a repository hooksPath.
`npm run check:hooks` verifies executable hook contents against the inspected
upstream revision. `test:hooks` creates and removes a disposable local repo and
bare remote, uses the current identity/session/policy, tests a legitimate
commit/push and two intentional denials. It never publishes fixtures to GitHub.
It requires the repository's automatic sign-off policy; a human-certification
policy must be handed back, not overridden to make the exercise green.

On a fresh host without hooks, first inspect the pinned upstream checkout:

```sh
git clone https://github.com/kirkbrauer/git-attribution-hooks.git /your/trusted/hooks-source
git -C /your/trusted/hooks-source checkout 4b7d05eff74e56a7277cbbb22ac77ad4247bc43b
# Human-owned global setup; inspect installer first. Do not use --force.
/your/trusted/hooks-source/install.sh --copy
```

Then run the hook checks. Installation uses upstream's supported installer and
smoke test. This repository does not run it automatically or alter Git identity.
The installed hooks correctly attribute Pi to Pi regardless of model provider;
legacy reference-bundle Codex trailer examples are not instructions to invent
Codex involvement. DCO presence is not human review.

## Layout and review

- `packages/tooling/src`, `packages/tooling/tests`: TypeScript foundation tools and tests.
- Root npm workspaces + lockfile: one install; common strict TypeScript configuration.
- Each workspace owns `build`, `typecheck`, and `test`; CI never silently skips them.
- `config/`: portable exact tool/hook inputs, no credentials.
- `.github/workflows/checks.yml`: read-only hosted PR and merge-group validation.
- `docs/BOARD.md`: lightweight Tier 0 progress and acceptance dependencies.
- `docs/REVIEW-HANDOFF.md`: tested revisions, limitations and next actions.

Following DESIGN §12, introduce `packages/core`, `policy`, `execd`, `workspace`
and thin Pi packages only when their tiers introduce real behavior. Do not
create dozens of empty packages. Trusted broker distribution remains separate
from Pi extensions; private platform/personal settings stay outside this repo.

See [forge constraints](docs/FORGE.md). Stop at Kirk's review gate; a green CI
run or a queued/merged individual PR does not accept Tier 0.

## Recovery

Reinstall only ignored `node_modules` with the locked `npm ci` command. Preserve
checkouts and unpublished changes. For hook drift, inspect upstream and the
configured `core.hooksPath`; do not overwrite or bypass it. No host services or
VM state are created by these foundation checks. Do not uninstall existing
host tools as a rollback for this repository.
