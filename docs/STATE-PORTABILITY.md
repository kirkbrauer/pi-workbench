# Local state, Git backups and machine transfer

Design refinement, 2026-09-06. Builds on [Work and resumption](WORK-AND-RESUMPTION.md).
The current increment implements **local SQLite schema migration only**. Logical
export/import, Git backup, machine relocation, JJ and Gerrit adapters remain proposed.

## Three different operations

1. **Schema upgrade:** the same installation opens an existing local registry with
   a newer reviewed schema. Preserve IDs, associations and selected context; apply
   migrations transactionally and refuse unknown versions or altered migration history.
2. **Recovery backup:** preserve a consistent copy/export of important state so it
   can be recovered after loss. This does not grant execution authority or make a
   stopped process resumable. Raw SQLite recovery copies belong outside Git.
3. **Machine transfer:** restore portable work metadata on another installation,
   then explicitly rebind machine-specific resources. It is not copying a live DB,
   a schema upgrade alone, or silently enrolling the destination.

Do not make a future export's format version synonymous with SQLite `user_version`.
A stable logical format can outlive several ORM schemas. Import validates and maps
that format through supported code; it never executes migration SQL from an archive.

## What should be backed up in Git?

Prefer a human-reviewable, versioned **logical export**, explicitly enabled per
profile into a chosen repository. An illustrative layout, not implemented storage:

```text
workbench-state-backup/
  export.json                  # format version, profile/classification, origin, snapshot ID
  projects/<id>.json            # portable project/repository references
  work/<id>.json                # objectives, goals/tasks/dependencies and source links
  threads/<id>.json             # permitted thread metadata/checkpoint references
  notes/<id>.md                 # selected user-authored notes or approved summaries
```

Use stable IDs, deterministic ordering and typed relationships so diffs describe
changes in work rather than random database bytes. A committed export must represent
one coherent logical snapshot, not a mixture of tables read at different times.
Record origin and per-record versions; references must resolve or be explicitly
external/unavailable. Store progress, completion evidence references, loop plans,
consumed budgets and checkpoints where those domain records exist.

These are not new shadow copies of Jira or forge authority. Preserve native source
identities and timestamped observations; external state must be refreshed after
restore. A Work or internal goal can exist without a ticket. Restoring a completion
note does not recreate missing test evidence or close external issues.

**Exclude by default:** tokens, auth caches, SSH keys, signing/approval sockets,
leases/grants, credential-bearing URLs, live process identifiers, raw terminal logs,
full private transcripts and mutable environment observations. Paths/topology and
summaries may also be sensitive; “metadata” is not automatically public. Select a
private work-approved repository for work data, separate from personal/public state.
An export allowlist and classification check must precede Git staging/publication.
Git history retains deleted material, so removing a secret later is not prevention.

Do not synchronize `registry.sqlite`, WAL/SHM/journals, Pi state directories or a live
SQLite file through Git, a network filesystem or filesystem-sync software. Raw local
recovery copies should include the complete closed state directory (or use a tested
SQLite backup API later), with private permissions and appropriate encryption and
retention. A Git logical export and a database disaster-recovery image serve different
purposes; neither should silently contain the other's excluded data.

A future backup command should first export/validate, then show the diff. Committing
and pushing follow their own existing authorization and attribution paths. No
scheduled backup, credential use, automatic push or new Git remote is enabled here.

## Restoring on another machine

Proposed sequence:

1. Select the destination profile and approved Workbench installation. Validate the
   export's format, provenance/classification, references and conflicts before import.
2. Import into private staging state. Preserve portable Work/Project/goal/task/thread
   IDs. Namespace/reconcile origin IDs rather than silently overwrite collisions.
3. Keep old environment/workspace IDs as historical references. Allocate a new local
   environment identity and explicit destination bindings; do not relabel the source
   host's identity as the new machine. If the old checkout still exists independently,
   the new checkout is another Workspace. A true move needs an explicit relocation
   record, not inference from an equal path or branch name.
4. Verify repository identity and observed revision, choose a build-compatible checkout
   strategy, and remap paths/checkout-set members through an explicit plan. Logical
   exports contain no checkout bytes: acquire permitted source separately via Git or
   an approved source checkpoint. Missing/dirty/unpublished source needs preservation,
   not an automatic reset or remote fetch from an untrusted exported URL.
5. Reconcile run history. Restore previous active steps as interrupted/unknown pending
   evidence, not automatically running. Preserve consumed loop budgets and attempts;
   do not replay side effects, revive leases, or transfer approvals. Clear foreground
   selection until the user chooses a verified destination context.
6. Reconcile conversation availability through the harness adapter. A session reference
   alone is not a transcript backup. Pi-supported history export/import or a selected
   permitted summary needs its own validated data-transfer path. Never copy host auth
   caches to make a conversation resume. Existing Pi public-SDK compatibility failure
   remains a separate blocker, not solved by registry import.
7. Publish the reconciled local state only after validation, retaining a recovery path.
   Report unavailable sources/checkpoints honestly and reacquire any required execution
   authority on the new machine.

For same-machine disaster recovery, verified existing environment/workspace bindings
may be retained; they must not be automatically assumed valid after a host change.
Git conflict resolution must respect typed IDs, dependency graphs and record versions.
Do not apply last-writer-wins to loop progress, active-writer state or approval data.
Two machines editing a backup repository is not a distributed execution protocol.

## Revision and review identities: Git, JJ and Gerrit

Keep **source snapshots**, **logical changes**, **review records** and **workspace
identity** separate. A branch name, PR number or logical change ID cannot replace the
immutable revision/snapshot used by a test or approved action.

| Identity | Meaning / scope |
|---|---|
| Workspace ID | Stable Workbench checkout identity; independent of branch/review names |
| Source revision | Immutable commit/object identity interpreted by its VCS adapter; dirty source requires a separate snapshot binding |
| JJ change ID | Logical change identity within repository context, potentially retained across rewritten commit incarnations; divergence can produce several incarnations |
| Gerrit Change-Id | Review association metadata, not a commit SHA or globally unique review locator; resolve in server/repository/target-branch context |
| Review identity | Profile/connector, forge instance, repository and native review ID; retain actual authoritative mapping |
| Review revision | Specific Gerrit patch set or forge head/update, with its tested source commit/snapshot |

A future `Revision` contract should be tagged by VCS and carry immutable identity;
optional logical-change references belong alongside it, not in its `revision` field.
A review contract should discriminate GitHub PR, GitLab MR and Gerrit change, rather
than assume every review has a PR number or one branch. Preserve native patch-set
identity and source mapping, including when the current checkout contains unpublished
changes. Resolve shortened/ambiguous IDs through the adapter; never pick an arbitrary
JJ incarnation or infer a Gerrit review solely from a commit-message trailer.

A rewrite that keeps a JJ change ID or Gerrit Change-Id still creates a new source
revision. Old tests and approvals remain bound to the original revision; they do not
become evidence for new bytes. Imports preserve both logical links and original
revision-bound history, then revalidate the destination/current review mapping.

The current registry's `revision` is the Git HEAD object ID observed by its Git
adapter, and `branch` is nullable. The ORM migration preserves those values unchanged.
It neither treats detached HEAD as failure nor claims that Git inspection correctly
tracks a colocated JJ working copy. JJ/Gerrit support requires explicit adapters and
additive/reviewed schema migrations; do not overload current Git fields to simulate it.

## Acceptance for later implementation

Prove deterministic export from a consistent snapshot; positive/negative sensitive-
field fixtures; same-profile restore with preserved IDs; conflicts and missing
references rejected; old/new export-format compatibility; machine rebinding without
credential/grant transfer; interrupted runs not duplicated; paired multi-repo evidence
retained; and logical-change identity remaining distinct from rewritten snapshots.
These are future checks, not passing tests supplied by this document.
