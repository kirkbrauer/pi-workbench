# Work, projects and morning resumption

Design refinement, 2026-09-06. Kirk's workflow is the driver: open a terminal,
see today's work across several project directories and machines, understand the
linked tickets/reviews, and resume the appropriate conversation without rebuilding
context. This supplements DESIGN §§5, 9, 12 and 13.3/13.9; it does not claim a
working dashboard, session adapter, sync service or remote provider.

## The experience we are building toward

Home is a **work view**, not a directory picker or list of every agent process.
Load local/cached observations immediately. Group by Project, with actionable Work
cards and explicit profile/location/freshness. Offer a flat “needs attention” view
and search as well. User pins and last activity inform the view; opening a terminal
does not create a new day's task database or launch paused work automatically.

```text
Work profile — What would you like to move forward?

Voice platform
  Fix reconnect regression      Jira: Automotive / IVI-3921
    GitLab MR !84               Review comments waiting · fetched 10m ago
    Implementation thread      Fedora / reconnect worktree · resumable
    Investigation thread       Mac / analysis worktree · last active yesterday

Developer tools
  Improve diagnostics           GitHub issue #123 · PR #127
    Implementation thread      Mac / diagnostics worktree · running
    CI                          Failed at published SHA … · local edits not tested

Offline: Fedora observations are cached; running state is unknown until reconnect.
```

This example is synthetic. “Today” is an attention/priority view over durable Work,
not a claim that every listed item is due today. One source being offline must not
block the rest of the view or become “nothing to do.” Human review, implementation,
CI investigation and terminal attachment are different next actions.

## Domain relationships

**Keep the common case simple.** A single-repository Project with one ordinary
checkout needs no manifest, checkout set, special build constraints or loop. These
are optional capabilities introduced only when a project's work requires them, not
mandatory fields or setup steps imposed on every project. They should shape the
extension points without becoming prerequisites for the basic local workflow.

| Concept | Identity and role |
|---|---|
| **Profile** | Personal/work trust and data boundary; explicit before model context is assembled |
| **Project** | Long-lived engineering grouping with **one or many repositories as a normal case**, not identified by a directory name |
| **Repository** | Source identity independent of a clone's path; forge identity where verified, local opaque identity otherwise |
| **Work** | An objective/activity, possibly spanning Projects, tickets, reviews and machines; not synonymous with one ticket or PR |
| **External reference** | A link to authoritative Jira/forge state, retaining connector/profile, tenant/instance, native object ID and display label |
| **Workspace** | One independently mutable repository checkout in one environment, with observed revision and lifecycle owner |
| **Checkout set** | A concrete coordinated multi-repository checkout in one environment, such as a Google Repo manifest checkout; contains member Workspaces |
| **Goal** | An internal desired outcome with explicit acceptance criteria, scope and progress; may span repositories |
| **Task** | A concrete unit of planned work toward a goal, with dependencies and explicit workspace/action scope; no external ticket required |
| **Loop** | A bounded iteration/repair plan over tasks, with stop predicates, budgets and checkpointed progress; persistence is not execution |
| **Thread** | A named conversation line within Work, optionally linked to goals/tasks, with parent/fork relationships and explicit harness/workspace bindings |
| **Harness session** | Pi-owned conversation history/session tree; referenced by Workbench, not reimplemented |
| **Run** | An attempt to execute a task/loop step with pinned workspace context, budgets and evidence; distinct from the conversation, task intent and terminal process |
| **Terminal attachment** | A way to reach an existing human/agent terminal, not the conversation's durable identity or authority |

A Project has many Work items; a cross-project Work can reference multiple Projects.
Work can have several workspaces and threads. Several threads can discuss the same
checkout, but that is not permission for simultaneous writers. A Workspace retains
one primary Work binding initially; multi-Work reassignment/sharing needs explicit
semantics rather than duplicate registrations. A repository can participate in
several Projects without duplicating its source identity. Do not model a Project as
one repository plus exceptional attachments: backend, frontend, shared protocol and
infrastructure repositories are ordinary members, each with its own checkouts,
reviews, revisions and owners.

Tickets and reviews normally attach to Work. Projects can hold discovery filters
and project-level links, but a filter result must not silently create a new objective.
A PR can address several tickets, a ticket can require several PRs, and an
investigation can begin without any external record. User-confirmed links preserve
these relationships without cloning an issue tracker into Workbench.

`IVI-3921`, `#123`, `!84`, a branch name, remote URL or directory basename alone is
not a globally unique identity. Keep source tenant/instance and repository identity.
The same Jira key in two tenants stays distinct. A cached status is an observation;
Workbench pin/snooze/complete does not close tickets, resolve reviews or merge code.

## Internal goals, tasks and loops

Workbench must remember work that has no issue-tracker counterpart. A Work can
contain goals such as “reconnect works end to end”; tasks might change the shared
protocol, adapt the backend, update the client and verify the combination. The
related Jira ticket and three PRs are links, not the only places progress can live.

```text
Project: Voice platform
  Repositories: protocol, service, client
  Work: Fix reconnect across the stack
    Goal: Compatible retry behavior with regression evidence
      Task: Update protocol        → protocol workspace / PR A
      Task: Implement server       → service workspace / MR B
      Task: Adapt client           → client workspace / PR C
      Task: Verify revision set    → selected test action(s)
      Loop: Inspect failure → repair affected task → verify
        Bounds, attempt count, stop reason and last checkpoint retained
    Threads: design discussion, implementation, integration debugging
```

The relationship is a small graph, not a forced folder nesting. Threads may discuss
several tasks; tasks may wait on other tasks or external events; runs record actual
attempts. Internal task state and linked issue status stay distinct. Completing an
internal task does not close a Jira issue or PR, and a merged PR alone does not prove
a cross-repository goal is complete. Workbench owns internal goal/task intent;
external services retain authority over their native records. This does not replace
the GitHub review-facing board used to build Workbench itself.

Persist goal acceptance criteria, task dependencies/status and scope, loop plan
revision, iteration count, remaining budgets, latest evidence/checkpoint and reason
for waiting/stopping. A morning card should be able to say “client update finished;
integration failed; repair loop paused after attempt 2 of 3” from recorded facts,
not reconstructed model memory. Show planned/paused, running, awaiting input/approval,
blocked, failed and evidence-verified completion distinctly.

Ordinary code-edit/test actions target explicitly bound member workspaces. A
multi-repo task composes these steps; a workspace must not secretly stand for several
independently mutable repositories. Checkout-set lifecycle or integration operations
are separate typed capabilities with an explicit member set and operation scope
(see below), not unrestricted shell access to their parent directory. Integration verification must bind the
**revision set** (and relevant dirty snapshots/artifacts) across repositories; do
not combine unrelated green checks into an end-to-end success claim. Partial changes
and unpublished commits must survive a failed goal. Cross-repo updates are not one
atomic Git transaction, and rollback must not discard someone else's work.

Loops inherit the goal/task scope and cannot reset their budget by creating another
task, silently authorize a new destination, or keep going indefinitely. Resuming
first reconciles recorded runs/effects and current inputs; it does not replay all
steps. A persisted loop may be inert metadata in Tier 1. Only a later authorized
coordinator can execute it, with demonstrated bounds and recovery. This keeps goals
and planning first-class **without making a general workflow engine a prerequisite**.

## Checkout strategy follows the build system

**Git worktrees are preferred where compatible, not required.** Workspace identity
must not encode the assumption that linked worktrees are always feasible. Build
systems may require a real `.git` directory, a fixed absolute path, a particular
multi-repository layout, in-tree generated output or exclusive shared caches.

Supported design choices are ordinary independent Git clones, linked Git worktrees,
manager-owned checkout sets and explicit adoption of an existing checkout. Keep VCS,
checkout materialization, build-path/cache constraints and execution isolation as
separate dimensions. A standalone clone is a normal strategy, not a degraded security
profile; neither clones nor worktrees replace the required worker sandbox.

Record relevant constraints in the portable project/build contract, resolve host-
specific paths privately, and choose a compatible strategy when creating/adopting
workspaces. Do not silently replace a worktree with a clone or change project
layout just because an operation failed. Report the choice and preserve stable
workspace identity across any explicitly supported migration.

For parallel work, independent clones or complete independent checkout sets may be
necessary. Isolate build outputs and mutable caches where the build system permits;
otherwise serialize access. A fixed path inside each separately isolated environment
can be compatible with several workspaces, but this must be demonstrated for that
build/runtime, not assumed. Paths are scoped to environments, not globally unique.

If only one fixed checkout is feasible, model one Workspace and coordinate its
writers/builds. Several tasks or threads can reference it; that does not create
several independent checkouts. Never simulate independence by automatically switching
branches under an active process, stashing/resetting dirty work, or pointing several
workspace IDs at the same mutable directory. An in-place task transition needs
explicit preservation and execution reconciliation.

The current CLI already adopts both ordinary Git checkouts and linked worktrees;
it creates neither and does not promise build compatibility. Add real build-layout
fixtures when introducing workspace creation/provider operations, including at least
one worktree-incompatible case. Do not block the first useful task on making its
build system support worktrees.

## Coordinated multi-repository checkouts: Google Repo and checkout sets

A Project grouping is not enough to represent an Android-style Google Repo checkout.
Distinguish the **logical Project** from a concrete **CheckoutSet**: one coordinated
checkout root in one environment, whose manifest/provider owns member materialization.
A Project may have several checkout sets (feature, investigation, release) on different
hosts. Work can link several sets, but each set has an unambiguous owning environment.

```text
Project: Android platform
  Checkout set: reconnect experiment / Fedora / manifest-managed root
    Workspace: frameworks/base    → repository A, revision A1
    Workspace: packages/service   → repository B, revision B1
    Workspace: vendor/protocol    → repository C, revision C1
  Checkout set: release comparison / Mac / another root
    Workspace: frameworks/base    → repository A, revision A0
    …
```

Each independently mutable member is still a Workspace; a `.repo` root is **not**
a single Git repository. This refines DESIGN's optional composite view into a
first-class coordination/identity concept without weakening the one-repository-per-
Workspace invariant. Standalone Git worktrees need not belong to a checkout set.
An arbitrary folder containing repositories is not automatically manifest-managed.

A future checkout-set record needs stable ID, profile/environment, root locator,
manager kind (initially proposed `manual` or `google-repo`), ownership, member IDs and
relative paths, source manifest identity/revision, effective manifest digest and a
resolved member-revision snapshot. Includes, local manifest overrides, selected
project groups and manager options can affect membership; a manifest branch or
filename is not sufficient identity. Record unsupported/incomplete resolution
honestly rather than guessing the missing repositories.

**Manager-owned lifecycle:** a Repo adapter must inspect and use the actual Repo
contracts. Do not implement a manifest checkout by independently calling Git worktree
commands on every discovered directory. Nor should “fork this checkout set” mean
copying `.repo`, cloning random member paths or assuming every project has a same-
named branch. The manager may use shared Git object storage/worktrees, but those
internal paths are not Workbench's public lifecycle API. The choice of exact Repo
commands/options awaits an inspected implementation; no compatibility is claimed here.

**Task and conversation context:** select Work + checkout set + relevant member(s).
A set-level discussion can span the tree while every edit identifies its member.
Cross-repo integration tasks may need the assembled layout and approved read/write
access to several members; that must be represented in the prepared action and
sandbox mount contract, not silently granted by selecting the parent directory.
Resuming/forking into another set verifies membership and revision mapping and
preserves old evidence bindings. Do not expand every Repo project into the model's
context when only two members matter.

**Preservation and concurrency:** `repo sync`-style operations can change many
members and shared metadata. Treat coordinated materialization/sync/removal as
explicit set-scoped mutations, with affected-member and shared-store coordination,
identity/manifest revalidation, authorized network destinations and preservation of
dirty/unpublished changes. A writer lease on one member does not authorize a
concurrent set-wide sync. Cross-repo atomicity is not promised: interruption must
produce a reconciled partial state, not automatic resets or a complete-success label.
Manifest hooks and project task definitions are executable inputs, not permissions.

**Evidence:** bind integration results to the effective manifest plus the tested
member revision/snapshot set and relevant toolchain/configuration. Preserve per-member
review/CI links. One green repository pipeline does not qualify the entire assembled
checkout, and changing a relevant member invalidates that combined result.

This is a design requirement, **not a Google Repo provider in the current CLI**.
`workspace adopt` handles one committed Git checkout; it does not interpret `.repo`
manifests, enumerate groups, synchronize projects or qualify multi-repo mounts.
Introduce checkout-set contracts/fixtures before enabling manager execution in its
reviewed provider increment. Do not require Repo integration to finish the first
ordinary Git-based task.

## Conversations and “resume”

Expose distinct operations rather than one ambiguous command:

1. **Attach:** reconnect to an already-running, identified harness/terminal. Do
   not start a second writer because an observation is stale or a client disconnected.
2. **Resume conversation:** restore a known persisted Pi session/tree position in
   its validated workspace. Missing history is a reported condition, not permission
   to silently start an empty conversation under the old thread label.
3. **Fork into another worktree:** create a new thread/session from a chosen
   conversation checkpoint, preserving parentage and recording the new workspace
   and source observation. Old tool results still describe the old checkout.
4. **Handoff to another machine:** explicitly select the destination and transfer
   only permitted context/source artifacts. This is not moving a live process,
   forwarding credentials, replaying tool calls or copying an active database.

Default cross-worktree continuation to an **explicit fork**, not silent cwd
retargeting of a live agent. Thread labels and branches remain independent. A
thread can record successive workspace bindings when supported, but every action
retains its original context generation/destination; switching the foreground
view cannot redirect an in-flight run or revive an approval.

A future thread record should minimally contain an opaque ID, Work/profile IDs,
title, optional parent thread/checkpoint, owning environment, harness kind/version,
session ID and tree-entry/checkpoint reference, bound workspace, last source
observation and observed activity/freshness. Treat a session file path as a local
locator, not portable identity. Store brief permitted next-step summaries with
source/checkpoint provenance; never automatically ingest full private transcripts
into the morning inbox or a different model route.

Pi already stores JSONL session trees, UUID session headers, entry IDs and parent
relationships. Its documented `/resume`, `/tree`, `/fork`, `--session` and session
manager operations are the intended integration surface, not a new Workbench chat
format. Documented APIs are not proof of runtime compatibility: the pinned 0.85.0
public SDK import currently fails (see [PI-ECOSYSTEM.md](PI-ECOSYSTEM.md)). Actual
attach/resume/fork and cross-cwd behavior need adapter tests before enabling them.
No current registry command resumes a Pi conversation.

## Storage ownership and sharing

[State portability](STATE-PORTABILITY.md) further distinguishes schema upgrades,
logical Git backups and machine transfers, including future JJ/Gerrit identities.

**Use XDG with a dedicated `pi-workbench` namespace on both macOS and Linux.**
Do not put the cross-project registry in a checkout or derive it from cwd.

| Data | Location / authority |
|---|---|
| Registry, local associations and future thread/run metadata | `$XDG_STATE_HOME/pi-workbench/profiles/<profile>/`; default `~/.local/state/pi-workbench/profiles/<profile>/registry.sqlite` |
| Private preferences, connector aliases and selected configuration sources | Future `$XDG_CONFIG_HOME/pi-workbench/`; default `~/.config/pi-workbench/` |
| Rebuildable caches | Future `$XDG_CACHE_HOME/pi-workbench/`; default `~/.cache/pi-workbench/`; retain profile separation |
| Live sockets/leases | Future owner-private runtime location under a validated `$XDG_RUNTIME_DIR`; not Git or persistent config; macOS fallback still to specify |
| Pi conversation history | Pi's own configured session store; Workbench records scoped references, not replacement files |
| Credentials and human approval material | Existing dedicated credential/approval authorities, never project config or a shared registry export |
| Source and collaborative changes | Git and the forge remain canonical |
| Managed cluster workspace desired state | GitOps/Belt remain authoritative; local registry entries are references/observations |

Only the **registry state location** is implemented in this slice; config/cache,
run/artifact stores and runtime sockets are not created. `--state` overrides the
exact registry directory for tests/isolated installations; it must not point into
Pi's own state or an unrelated application store. The profile stays explicit.
Relative XDG state paths are rejected rather than used accidentally.

Workbench never uses or changes Pi's `.pi`/configured agent directory, any Pi-owned
`.local`, or this development repository's ignored `.local/` caches. Sharing the
standard `~/.local/state` parent is not sharing an application directory. Pi's
configuration environment variables do not select Workbench's store. Initialization
creates only the intended registry hierarchy; reads/help do not initialize it.

Project-local `.workbench` is **not the default home of active state**. Portable
project requirements may live in a reviewed project manifest, following an existing
project/Belt convention (DESIGN's `.workspace/project.yaml` is illustrative).
Do not introduce a competing `.workbench` manifest namespace just to store paths,
sessions or observations. Manifest filenames/fields can be finalized with the first
actual configuration consumer; no generic config-merging engine is needed now.

### Across my machines

Start with one controlling installation's profile-scoped index. A workspace's
owning environment owns its checkout and local execution state; the control client
caches references/observations. An SSH path is meaningful only with its enrolled
host/account identity; a cluster workspace also retains provider/lifecycle-owner
identity. Disconnected remote observations remain visible but stale.

Do not synchronize live SQLite files with Git, Syncthing, cloud folders or filesystem
replication, and do not share an SQLite database over a network filesystem. A later
adapter protocol can exchange versioned records/checkpoints with explicit origin,
ownership and conflict handling. Offline clients must not manufacture authority
from cached records. Multi-writer control-plane synchronization is deferred; Git
configuration sync is not an implementation of it.

### Sharing with a team or another profile

Share permitted **declarations and references** through reviewed Git configuration
or an explicit export: project IDs, repository references, ticket/review links,
portable requirements and approved skill pins. Reconcile IDs and report conflicts
on import; an import cannot silently adopt a local path or enroll a remote host.
Paths/topology may be private even when source URLs are public.

Personal pins, current selection, machine paths, sockets, credentials, approval
records and full transcripts stay local/private by default. Share a selected
conversation summary/checkpoint only through an explicit classified handoff;
redaction and source/provider policy still apply. Do not merge two active JSONL
session files or treat another user's approvals as transferable. Cross-profile
summaries are data transfers too, not harmless navigation metadata.

## Consequences for the current implementation

The current registry (schema 2 after the ORM migration) is a narrow beginning: Work, local repository and
workspace records, one local environment identifier, selected context and generation.
It has **no Project, CheckoutSet, Goal, Task, Loop, external-reference or Thread tables, session
adapter, remote index or sharing protocol**. Do not describe its `context show` as conversation
resumption. It restores registry context only.

Keep this first implementation reviewable. Next, introduce Project/repository membership, checkout-set membership,
Work/reference, internal goal/task and thread-reference contracts with fixture data and explicit migration tests, in
review-sized Tier 1 work. Record bounded loop/checkpoint shapes without implementing
a scheduler or enabling background execution. Model the relationships before growing prepared actions
around a checkout-only notion of context. Keep session references metadata-only until
a real Pi adapter passes its tests. A future Home query can aggregate these records
without requiring UI, remote discovery or live issue credentials in Tier 1.

Then finish fixture prepared actions/approvals, run state and bounded artifacts.
The first real sandboxed Pi task remains the operational milestone; full Home/TUI,
remote enrollment and team synchronization retain their later review gates.

Future acceptance scenarios: reopen to the same Work, goal/task progress and selected
thread; distinguish a Repo checkout set from a single Git workspace; retain effective
manifest/member identities across two independent sets; support a build that requires
an independent clone/fixed path without a silent branch switch; show a multi-repository
objective with multiple tickets/reviews without
duplicate cards; bind integration evidence to its revision set; restore a paused
loop's attempts/budget without executing it twice; distinguish same-key
Jira tenants; switch/fork between two worktrees without redirecting an active writer;
show an offline remote thread without starting a replacement; and share permitted
project references without copying credentials, live state or private conversation.
