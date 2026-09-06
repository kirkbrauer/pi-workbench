# @pi-workbench/core

Persistent local Work/Workspace context for Pi Workbench. This is the first
**Tier 1** product slice: track an objective, adopt existing Git checkouts, choose
one explicitly, and recover that selection after restarting the client.

It is **not** a broker or worker launcher. Registration, a profile label, a
context generation, and successful inspection grant no execution authority.

## Requirements and build

Use the repository's approved pinned Node **22.23.2**, Corepack **0.34.6** and
pnpm **11.25.0**. From a trusted Workbench checkout whose dependencies have been
installed with the frozen/no-script policy:

```sh
pnpm --filter @pi-workbench/core build
pnpm --filter @pi-workbench/core test
pnpm --silent workbench --help
```

The CLI uses **Commander 15.0.0**, Git inspection uses **simple-git 3.36.0**, and
persistence uses **Drizzle ORM 0.45.2** over Node's built-in SQLite. No native addon or installation script
is required by this package. Node 22 emits an experimental SQLite warning on
stderr; command results are JSON on stdout. Do not mix those streams when parsing.

Initial platform scope is local POSIX (macOS/Linux), with an already installed
`/usr/bin/git` supporting `rev-parse --path-format=absolute` (Git 2.31+).
No Git binary download, PATH fallback, remote fetch, credential discovery or
host setup occurs. Git is a host prerequisite, not part of a new bundle.

## A first task

Run from the trusted Workbench checkout, **not** from candidate source. Select the
intended profile explicitly; Workbench uses its dedicated XDG state namespace:

```sh
PROFILE=personal
wb() { pnpm --silent workbench --profile "$PROFILE" "$@"; }

wb init
wb work create "Implement feature" "Produce a tested, reviewable change"
```

Copy the returned `result.id` as `WORK_ID`. Use **existing**, independently mutable
Git worktrees; this CLI does not create or delete checkouts:

```sh
wb workspace adopt "$WORK_ID" /absolute/project-worktree-one
wb workspace adopt "$WORK_ID" /absolute/project-worktree-two
wb list
wb context select "$WORKSPACE_ID" 0
wb context show
```

`WORKSPACE_ID` is an ID returned by adoption, not a path, branch or guessed name.
`0` is the initial context generation; after selection the returned generation is
`1`. Later switches must supply the latest observed generation. Reopening a new
shell/client against the same state/profile and running `context show` restores
the selection and rechecks Git identity, HEAD and branch. It starts no agent or
terminal session.

`wb --help`, `wb workspace --help` and `wb context --help` provide command discovery.
Unknown options, profiles, commands and extra arguments fail. Use shell quoting
for names/paths and Commander’s `--` separator for operands starting with a dash.
No profile or target checkout is inferred from the ambient working directory;
the registry directory defaults only from the documented XDG/HOME configuration.

### Results and recovery

All successful command results have this envelope:

```json
{
  "scope": "local-registry-only-not-execution-authority",
  "observation": "command-result",
  "result": {}
}
```

`list` uses `observation: "stored"`: its Works, repositories, workspaces and context
are stored observations, potentially stale. `context show` instead checks the
selected checkout. Failed commands exit nonzero; do not treat partial stdout as
success. Help exits zero but is text, not a command-result envelope.

- **Stale generation:** reread `list`/`context show` and decide whether the intended
  switch is still appropriate. Do not blindly retry a mutation with a new number.
- **Changed HEAD/branch:** show the old stored and current Git observations to the
  operator. For an intended change, explicitly run
  `wb workspace refresh "$WORKSPACE_ID" "$GENERATION"`. This updates metadata and
  increments the global context generation, even for an unselected workspace.
  It does not reset, checkout, stage, commit or discard source.
- **Missing/moved/replaced checkout or Git storage:** stop and inspect. `refresh`
  cannot accept a changed root, Git directory, shared directory or its observed
  device/inode/birth-time fingerprint. Automated relocation, reassignment and removal are not implemented.
- **Wrong profile:** use the correct profile's independent state directory; do not
  relabel or copy its database to make the check pass.
- **Unsupported schema/corrupt state:** retain the original. No downgrade, reset or
  recreation fallback. Back up the complete private state directory only while
  all clients are closed, retaining any SQLite recovery files. Never synchronize
  a live database or assume copying it to another host establishes host identity.
- **Busy database:** a one-second SQLite busy timeout fails the operation; there is
  no application retry loop. Reconcile before retrying.

## State and API

Default database on both macOS and Linux:
`$XDG_STATE_HOME/pi-workbench/profiles/<profile>/registry.sqlite`, falling back to
`~/.local/state/pi-workbench/profiles/<profile>/registry.sqlite`. Relative XDG paths
are rejected. No state is inferred from the current project directory.

`--state /absolute/directory` overrides the exact registry directory for an isolated
instance/test. `init` creates missing parents with private modes without chmodding
existing ancestors. Reads/help never initialize missing state. Use trusted parent
directories; do not point an override into Pi's or another application's store.
Workbench does not use Pi configuration variables or write into Pi's `.pi`, any
Pi-owned `.local`, or the repository's ignored development `.local/` directory.

See [Work and resumption](../../docs/WORK-AND-RESUMPTION.md) for Project/Work/thread,
multi-repository and sharing design. Ordinary clones and worktrees are both valid;
checkout sets and special build constraints are optional future capabilities.

`Registry` in `src/registry.ts` exposes:

- `registryDirectory(profile, optionalOverride)` resolves the CLI's state path without creating files.
- `await Registry.open(absoluteDirectory, "personal" | "work", create = false)` and `close()`.
- `await createWork(name, objective)` and `await list()`.
- `await adopt(workId, absoluteCheckoutRoot)`.
- `await select(workspaceId, expectedGeneration)` and `await context()`.
- `await refresh(workspaceId, expectedGeneration)`.

Opening and all data operations are asynchronous; await them before calling `close()`
in `finally`. This replaces the previous synchronous constructor/create/list API.
CLI commands and JSON shapes remain compatible.

SQLite schema **2** initializes from an empty database only when `create` is explicit.
Opening an existing registry—including for `list`—can apply the reviewed schema-1→2
upgrade. It preserves all record IDs, profile, context generation/selection and Git
observations. Wrong-profile opens fail before migration writes. Unknown versions,
schema drift, missing/altered migration history and unrelated databases fail without
reset. Failed migration DDL, version changes and journal writes roll back together.
Before adopting an upgraded release, preserve a closed-state recovery copy. An older
schema-1 binary will refuse schema 2; downgrading a binary does not undo migration.
Retain post-upgrade work rather than blindly replacing it with an old backup.

Opaque UUID-based Work, repository, workspace and local environment IDs persist.
Each workspace initially belongs to one Work. Checkouts sharing a canonical Git
common directory share one local repository record; independent clones are not
automatically equated by remote URL. Detached HEAD is valid, unborn/bare repos and
subdirectories are not. Re-adoption of unchanged checkout/Work bindings is
idempotent; Work creation intentionally creates a new record each time.

Drizzle's typed schema and inferred rows replace handwritten application queries and
row casts. Its public SQLite proxy callback executes locally against `node:sqlite`;
there is no remote SQL endpoint. The adapter's small, tested result-shape compatibility
cast handles array-return/missing-row typing gaps, not domain-row coercion.

SQLite transactions and foreign keys protect registry updates. A per-file async queue
serializes ORM transactions within one JS process; cross-process exclusion remains
SQLite `BEGIN IMMEDIATE` with the existing busy timeout. Selection/refresh
use compare-and-swap generations, rechecked after asynchronous Git inspection, so
concurrent clients cannot silently overwrite one another's context. Stored and
returned revisions are HEAD commit IDs, **not hashes of dirty working-tree bytes**.
Dirty files are neither rejected nor modified; source snapshotting belongs to the
later prepared-action contract.

State directory mode is 0700, database/recovery-file mode 0600, owned by the current
ordinary POSIX user; linked state files and final-directory symlinks are rejected.
These are checks on trusted, stationary local storage, not secure traversal against
hostile parents/concurrent writers. The database is operator-controlled, not an
untrusted SQLite input. Profiles partition records through separate stores and
explicit checks, not OS isolation from the same host user. The environment ID is a
local registry identifier, not an attested host or approved execution destination.
The Git storage fingerprint is also only a local observation: birth time helps detect
inode reuse after replacement, but unavailable/coarse or manipulated filesystem
metadata can hide replacement. It is not proof of repository identity or an action
security boundary.

Git observations use simple-git's process queue/abort API, a fixed binary and a
replacement environment without ambient Git overrides or user/system Git config.
Only `rev-parse` and `symbolic-ref` are issued. Repository-local configuration is
still Git input; this is not a hostile-repository sandbox. The adapter requests
abort after five seconds or 16 KiB of observed Git output; this is not a hard
memory, process-tree or stalled-filesystem confinement boundary. Library unsafe
operation guards remain enabled. No attribution hooks are modified or bypassed;
production commands do not commit or push.

## Developing migrations

`src/schema.ts` defines typed tables. Drizzle Kit **0.31.10** maintains reviewed SQL
and snapshots under `migrations/`, which ships with the compiled package:

```sh
# From the repository root, after editing the typed schema:
pnpm db:generate --name=describe_change
pnpm db:check
pnpm --filter @pi-workbench/core test
```

Generation does **not** authorize application. Review the SQL, update the supported
schema version and its `PRAGMA user_version` migration, and add populated-upgrade,
failure/rollback and drift tests. Do not use `drizzle-kit push` against user state.
Both the generated history check and runtime migration tests matter; TypeScript cannot
prove that arbitrary SQL or a data migration is correct.

The historical baseline retains the original STRICT tables/inline constraints.
Drizzle Kit does not encode STRICT in its snapshots, so generated rebuilds require
explicit review to retain it. Schema 2 adds lookup indexes and named unique indexes
matching Kit's snapshot; the legacy inline uniqueness remains as well. The runner
validates the actual application schema against applied migration DDL, adopts schema 1
without replaying its seed rows, checks every applied migration hash/order, and uses
the official Drizzle migrator inside one outer transaction. Historical SQL is immutable
once released. Raw SQL is confined to migrations, driver/SQLite administration and
introspection, not interpolated application queries.

Kit and its matching ORM are explicit root development dependencies because Kit's
own dynamic imports require that visibility under our no-hoist policy. Runtime core
declares ORM directly. No peer policy override or native installation script is used.
The pinned Kit tree currently introduces **one moderate** development-only esbuild
advisory, [GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99),
through its deprecated ESM-loader dependency. The existing high/critical audit gate
is unchanged; no suppression is applied. We use generation/checking only, not an
esbuild development server or Drizzle Studio. This is a residual dependency risk,
not a claim that the advisory is fixed.

[State portability](../../docs/STATE-PORTABILITY.md) describes future logical Git
backups, machine rebinding and distinct Git/JJ/Gerrit revision/review identities.
No export/import, Git backup, remote transfer or new VCS/review adapter is implemented
by this local ORM/schema migration.

## Pi integration and skill

[Pi ecosystem choices](../../docs/PI-ECOSYSTEM.md) records inspected upstream tools
and deliberate differences. Workbench does not import private Pi internals or
load provider credentials for registry operations.

The [Workbench skill](../../skills/workbench/SKILL.md) explains the task flow to
agents. It is repository-scoped and opt-in, not installed into global Pi settings:

```sh
# In a separately approved Pi session, with an absolute path to this checkout:
pi --skill /absolute/pi-workbench/skills/workbench/SKILL.md
# Then invoke /skill:workbench, or let its description match the task.
```

No candidate skill is auto-loaded/reloaded into the running harness by this PR.
Skill text never grants permissions or turns observations into approvals.

## Next slices

Typed action preparation, fixture policy/approval binding, fake-provider run state,
bounded artifacts and duplicate-request reconciliation complete the focused Tier 1
contract. They are not implemented here. Real sandboxed Pi tasks require Tier 2
review and remaining worker-boundary evidence. Rich UI, remote enrollment,
distribution and general workflow scheduling are not prerequisites for this registry.
