# Tier 1 review handoff — typed SQLite ORM and migrations

## Accepted base and scope

Kirk merged registry PR #12 as `a8b4e4dfb3086e081e5cca6c343661aaabc6e24b` and
requested a type-safe SQLite ORM with migrations. This increment starts directly
there on `feat/t1-typed-sqlite`. Development remains on macOS, within focused Tier 1.
No native worker, remote enrollment, UI or workflow engine is enabled.

## Resulting behavior

- Drizzle ORM **0.45.2** typed SQLite tables, queries and inferred domain rows replace
  handwritten application SQL and `as unknown as Work/Workspace` casts.
- Public Drizzle SQLite proxy adapter runs entirely in-process on the existing
  Node **22.23.2** `node:sqlite`; no remote SQL, new SQLite engine or native addon.
- `await Registry.open(...)` and asynchronous create/list APIs; CLI syntax, XDG
  storage, IDs, JSON results, profile checks and context-generation semantics remain.
- Drizzle Kit **0.31.10** generation/check commands and versioned SQL/snapshots.
  Exact schema-1 databases are adopted without replaying their seed rows, then
  upgraded to schema 2. All identities, context and Git observations are retained.
- Applied migration hashes/order and actual schema are checked. Wrong profile,
  unknown schema, unrelated data and tampered history fail. The official migrator
  runs inside an outer IMMEDIATE transaction with rollback of DDL/version/journal.
- Per-file JS queue protects asynchronous transactions sharing a file; SQLite
  remains the cross-process locking mechanism. Git inspection stays outside writes.
- Eight new behavior tests plus compile-only negative type contracts; existing
  tests are adapted to async calls without removing their assertions.

[Core README](../packages/core/README.md) documents the API change, migration/recovery
procedure and limitations. [State portability](STATE-PORTABILITY.md) records Kirk's
additional requirements: logical Git backups, explicit machine rebinding, and
separate immutable revision versus JJ/Gerrit change/review identities. These are
future contracts, **not implemented export/import, sync or new VCS adapters**.

## Dependencies and review focus

Runtime adds one Drizzle package; generator tooling raises the lock from 285 to
**347 registry records**. Kit and its matching ORM are explicit root development
dependencies: Kit dynamically imports ORM without declaring it as a peer. This
placement works with the unchanged no-hoist/strict-peer policy; no fallback module
lookup, peer waiver, lifecycle script or source-policy exception is introduced.

Kit's deprecated ESM-loader chain brings **one moderate development-only esbuild
advisory**, GHSA-67mh-4wv8-2f99. High/critical counts are zero under the unchanged
required audit threshold. No advisory suppression is used. No esbuild dev server
or Drizzle Studio is started; the vulnerability is not claimed fixed.

Review separately:

1. **Driver/type boundary:** array results (including duplicate names), missing rows,
   nulls and prepared parameters. One adapter-local compatibility cast accommodates
   upstream typings; application rows are ORM-inferred. Type safety does not prove
   arbitrary SQL, runtime input or migrations correct.
2. **Migration correctness:** populated historical fixture, preserved IDs/selection,
   unchanged STRICT/foreign-key/uniqueness constraints, journal adoption and atomic
   rollback. Drizzle snapshots do not encode STRICT; generated rebuilds must retain
   it explicitly. Named unique indexes coexist with legacy inline uniqueness.
3. **Concurrency and test changes:** existing context races still reject stale
   generations. Async APIs do not expose another transaction's partial writes through
   the registry. The new compile-only expected-error cases enforce type failures;
   they are not production diagnostic suppressions.
4. **Scope:** opening an existing DB can migrate it even for a read command. Take a
   closed-state recovery copy before upgrading releases. No automatic backup/down-
   migration is claimed. Old schema-1 binaries reject schema 2; preserve newer work
   when recovering rather than blindly restoring old bytes.

## Validation

```sh
pnpm check
pnpm db:check
pnpm db:generate --name=drift_probe  # unchanged schema must generate nothing
pnpm audit --audit-level high
pnpm check:hooks
```

Core coverage includes original CLI/path/profile/Git/concurrency regressions, populated
v1→v2 upgrade/reopen, wrong-profile/schema-drift byte preservation, injected migration
failure with complete rollback and successful retry, changed migration history,
constraint retention, proxy row/parameter mapping, transaction-queue failure release,
and isolated schema-generation no-op/real-change detection. Kit's absolute-output-path
fixture initially printed an error while exiting zero; using cwd-relative output as in
production fixes that fixture without removing its semantic success assertions.
This tests SQL-error rollback, not all process-kill, filesystem or disk-full failures.

Candidate SHA, config/lock/source hashes, exact runtime and clean-clone/hosted evidence
will be attached to the PR. No worker image applies to these host-side fixture tests.
Existing hook checks and real commits/pushes remain authoritative; no attribution
integration change or manufactured trailers.

Baseline #12 [Foundation run 34043738163](https://github.com/kirkbrauer/pi-workbench/actions/runs/34043738163)
passed candidate `e48be7920adf5dcdece1a39d4844b6918663c85a` on tested merge
`5eccc5377b1c9fc3a51415925b035753e4180644`, ubuntu-24.04 image 20260831.293.1,
Node 22.23.2: 63 JS/TS passed + one actual-session hook integration skip; 11 Python
passed + one Mac OpenSSL skip. That is not new ORM evidence.

## Remaining gates

Pi 0.85.0's public-SDK import failure on undeclared `pi-server` is unchanged and not
hidden by the pin-bound skill implementation inspection. Existing native resource/
credential-boundary gaps remain unresolved; accepted Landlock/raw-stop limitations
are not passing tests. No full Tier 1 or worker acceptance is implied.

Kirk also requested [scoped post-turn development checks](POST-TURN-CHECKS.md) with
direct model feedback and TypeScript-first LSP diagnostics. Implement that as a
separate small tooling increment; nothing
is installed or enabled in this session by the design document.

Next domain work: small fixture-backed domain migrations for Projects/Work/goals/tasks/threads,
then prepared-action/approval and fake-run/artifact contracts. Optional multi-repo,
Repo and fixed-build-path cases should inform the contracts without becoming setup
requirements for every project. Keep bundle work, real remote placement and generic
scheduling off this critical path. Stop for Kirk's GitHub review; no merge/enqueue.
