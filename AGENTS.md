# Pi Workbench contributor contract

- Kirk authorized focused Tier 1 after reviewing/merging the foundation (through PR #11). Implement local domain/registry/context contracts, a minimal CLI, fixture action/policy/approval contracts and a fake provider in review-sized increments. No real worker, remote enrollment, UI or workflow engine yet. Remaining native worker-qualification gaps are not waived. Bundle/distribution work is deferred.
- Read `README.md`, `docs/BOARD.md` and `docs/REVIEW-HANDOFF.md`. Architecture baseline 1.27 is versioned under `docs/design/`; the imported mockup references are not executable software.
- Work on feature branches and small stacked PRs. Do not merge or enqueue on behalf of Kirk.
- Preserve the installed `git-attribution-hooks`. Follow the actual active harness metadata; do not invent a model co-author or claim another agent's assistance. Hooks supply assistance and the configured DCO sign-off. Never write a human sign-off, override identity, disable attribution, skip hooks, or work around a refusal.
- Use the pinned pnpm through Corepack, never npm install. Run `pnpm check`, `pnpm audit --audit-level high` and `pnpm check:hooks`. Run `pnpm test:hooks` inside the real agent session when changing attribution integration. Fixture rejection is expected; unexpected hook refusal stops publication.
- Keep personal/work credentials separate. Never expose host home, auth caches, SSH/keyring/engine/approval sockets to a worker. No real account enrollment in this focused Tier 1.
- Host installs, sudo, networking and service changes need concrete scoped authority. Preserve SELinux, firewalld and existing workloads. Never substitute a container for a required VM.
- Acceptance evidence names the tested SHA, configuration digest, runtime and image. Unknown or stale evidence blocks completion. Review changes to checks separately; no weakening checks to pass.
- Scripts are ordinary scripts, not a trusted execution broker. Do not run candidate repository scripts with elevated privileges.
