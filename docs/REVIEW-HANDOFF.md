# Tier 1 review handoff — local Work/Workspace registry

## Scope transition and base

Kirk explicitly requested: **“let's proceed with the focused Tier 1”**, after
reviewing/merging the foundation. PR #11 is merged as
`5d3ae5203f7f8d4d7d97a6e014d93e8459aade5a`; this increment starts directly there on
`feat/t1-workspace-registry`. Development remains on macOS.

The current priority is DESIGN §§5/9/15: a usable local work loop, not additional
bundle infrastructure. Kirk also requested Git/CLI library reuse, inspection of
Pi's ecosystem, a CLI skill and a package README. Those are included here.

This authorization opens **focused Tier 1**, not Tier 2 worker execution. Existing
Landlock/raw-stop scoped acceptance remains intact; guest PID and broader boundary
qualification gaps remain unresolved. No failed native test is reclassified as a
pass. No new native VM, host install, remote enrollment, credential or service
change is performed. `AGENTS.md` records this scope rather than a blanket waiver.

## This increment

- `packages/core/`: persistent Work/repository/workspace/local-environment IDs,
  existing-worktree adoption and SQLite context with compare-and-swap generations.
- Read-only Git observations through simple-git, explicit identity/revision/branch
  drift checks, explicit metadata refresh without checkout mutation.
- Commander CLI with help/subcommands, required profile, dedicated XDG state defaults,
  an explicit state override and JSON results; no collision with Pi-owned state.
- `packages/core/README.md`: package setup, walkthrough, API, state/recovery and limits.
- `docs/WORK-AND-RESUMPTION.md`: morning workflow and storage/sharing refinement;
  optional multi-repo checkout sets, build constraints, internal goals/tasks/loops
  and conversation threads are design requirements, not implemented features.
- `skills/workbench/SKILL.md`: opt-in task-oriented Pi guidance; no global install,
  automatic harness reload, candidate extension execution or permission grants.
- `docs/PI-ECOSYSTEM.md`: pinned upstream observations; reuse public conventions,
  not private Pi internals. TypeBox/shared-action and Pi TUI consumers follow later.

Direct runtime additions: Commander **15.0.0**, simple-git **3.36.0**. Both satisfy
the release quarantine. Six new registry records, **285 total**; existing lock
records are unchanged. SQLite comes from pinned Node 22.23.2 and emits its honest
experimental-feature warning. No lifecycle script, hoist/peer/source-policy exception,
CI/lint policy relaxation or attribution integration change is introduced.

## Review focus

1. **Useful context:** two Git worktrees have independent workspace IDs but share a
   local repository record. Selection survives process restart; HEAD/branch drift
   fails rather than rewriting files. Dirty source is retained but not snapshot-bound.
2. **State semantics:** explicit init, schema-1 reopen/empty-database migration,
   future/unrelated schema refusal, profile mismatch, transactional rollback and
   competing client generations. IDs are local registry identities, not host attestations.
3. **Reuse and limits:** no bespoke argument parser or subprocess queue; library
   unsafe-operation guards stay enabled. Registry permissions and Git observation
   budgets are not a sandbox or verification-to-execution handoff. No current result
   may authorize a test, agent, SSH operation or publication.
4. **Agent usability:** skill commands match the actual CLI and teach resume-before-
   create, stdout JSON parsing, explicit profile/generation and non-destructive recovery.
   The pinned skill-loader inspection retains positive/negative cases but does not
   qualify the public SDK: Pi 0.85.0 import failed on undeclared `pi-server`. Review
   that deliberately narrower test boundary separately; the original failure is
   retained and reproducible in [PI-ECOSYSTEM.md](PI-ECOSYSTEM.md). No runtime patch,
   dependency injection or private production import hides the SDK failure.

## Validation and evidence

```sh
pnpm check
pnpm audit --audit-level high
pnpm check:hooks
pnpm --filter @pi-workbench/core test
pnpm --silent workbench --help
```

The core tests use disposable local Git worktrees with raw synthetic commit objects;
no actual commit/push, identity override or attribution bypass is used to make
fixtures. Real project commits/pushes retain upstream hooks. Historical hook success
and intentional-refusal fixtures are not recast as new integration tests.

Candidate source/configuration/lock digests, exact committed SHA, clean-clone checks
and fresh hosted CI identities will be attached to the PR. Until then, local checks
are development evidence, not a published candidate acceptance claim. Worker image
is not applicable to these host-side metadata and synthetic fixture tests.

Prior #11 [Foundation run 34011202853](https://github.com/kirkbrauer/pi-workbench/actions/runs/34011202853)
validated candidate `79afd9e00ab11a8b29960b2bb362679ed8cf1923` on merge
`8a4302252b8bd9dd7ace6695f3eb1629b727d042`, ubuntu-24.04 image
20260831.293.1, Node 22.23.2: 49 JS/TS passed + one actual-session hook integration
skip, 11 Python passed + one Mac OpenSSL skip. That is baseline evidence only,
not validation of this registry.

## Remaining Tier 1 work

Next review-sized increments: Project/repository membership, optional checkout-set,
Work/reference, goal/task and thread-reference contracts with fixture state/migrations;
shared typed action preparation and fixture approval binding; fake-provider durable
run state, bounded artifacts and duplicate-request reconciliation. Keep the common
single-repo case simple; do not build a generic scheduler or Repo adapter now. Registry/context is the first slice, not complete Tier 1 or a broker.
After Kirk's tier review, one real sandboxed Pi implementation task remains the
operational goal, subject to its specific runtime/credential qualification gates.

Keep bundles, remote placement/enrollment, rich UI, team distribution and a general
workflow engine off this critical path. Do not merge/enqueue for Kirk. Preserve
unpublished work and the running host harness/toolchain.
