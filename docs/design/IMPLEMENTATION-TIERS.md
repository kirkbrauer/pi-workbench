# Pi Workbench: tiered implementation and GitHub review

Design baseline 1.27. This plan governs implementation sequencing and supplements the B0–B7 technical dependencies in BOOTSTRAP.md.

## Central progression: nondeterministic discovery to deterministic enforcement

**Implementation principle:** move from model judgment and exploratory checks toward deterministic hooks, CI checks and goal predicates. Pi discovers what needs verifying, proposes an executable check and demonstrates it against known outcomes. Once validated, the check becomes a versioned dependency used by subsequent workflows. Repeatedly asking a model whether something looks correct is not the final verification mechanism.

| Stage | Role of Pi | Authoritative result |
|---|---|---|
| Discover | Investigate behavior, inspect diffs/logs, identify invariants and uncertain requirements | Findings and proposed checks; no automatic completion claim. |
| Specify | Define inputs, expected outcomes, fixtures and failure semantics | Reviewed acceptance contract tied to the task. |
| Encode | Implement hooks, test commands, policy validators and goal predicates | Executable checks tested against passing and failing cases. |
| Enforce | Run checks locally and in CI, repair bounded failures | Recorded check result bound to the actual source/input revision. |
| Complete | Assemble evidence and explain remaining uncertainty | Deterministic goal evaluation plus any required human review/merge gate. |

Start Tier 0 by encoding known invariants immediately: attribution, pinned dependencies, buildability and supported sandbox requirements. Exploration is used for unknown behavior, not as a mandatory period without checks. Each later tier converts discovered recurring checks into enforced verification before declaring its capability complete.

### Three enforcement surfaces

1. **Hooks:** fast local feedback for attribution and inexpensive structural checks. Preserve the existing attribution hooks. Local hooks are convenience/enforcement on that path, not proof that every commit or server-side merge passed them.
2. **CI:** repeat independent verification at PR and merge-group revisions. Cover build/type checks, contract tests, security boundaries and applicable integration checks. Required checks cannot be replaced with an LLM review or a successful unrelated job.
3. **Goal checker:** evaluate explicit acceptance predicates against recorded evidence, including source revision, environment/profile, checker version and required GitHub review/merge state. Reject missing, stale, cancelled or skipped required evidence. Completion is computed by the trusted coordinator, not asserted by the implementing agent.

Use structured outcomes such as `pass`, `fail`, `unknown` and `not-applicable`. A required `unknown` remains blocking; not-applicable requires a rule from the acceptance contract. Infrastructure failures produce retryable/blocked outcomes rather than product success. Timeouts and unavailable remote systems must not be interpreted as a passed check.

### Goal predicate example

```yaml
# Proposed schema, not a stock Pi feature or an already-running checker
goalCheck:
  id: local-worker-increment
  acceptanceRevision: reviewed-acceptance-v1
  evidenceBinding: exact-candidate-revision
  allOf:
    - checkRef: build-and-contract-tests
      expected: pass
    - checkRef: sandbox-boundary-conformance
      expected: pass
    - checkRef: reconnect-without-duplicate-dispatch
      expected: pass
    - checkRef: artifact-revision-consistency
      expected: pass
  implementationComplete: all-required-checks-pass
  tierAccepted:
    required: [kirk-review-current-change, accepted-merge-observed]
```

Implementation completion and tier acceptance are separate states. GitHub observations must be authenticated and mapped to the reviewed/merged changes, accounting for stack rebases and merge-group revisions. A local check on an older head cannot validate a rewritten candidate. A merged PR does not alone prove every tier-level acceptance predicate.

### Check integrity and limits

Keep acceptance definitions and trusted checker versions outside the candidate's unilateral control. Pi may propose checker changes, but weakening a threshold, removing a failing assertion, changing fixtures to fit output or declaring an exclusion requires the appropriate review. Check code and product code can evolve in the same PR, with their changes separately visible. Establish positive and negative cases, including known regressions, before promoting a checker; avoid circular tests that merely echo the implementation.

A deterministic evaluator does not make external systems deterministic or guarantee exhaustive correctness. Pin controllable inputs, isolate fixtures and make nondeterministic integration conditions explicit. Keep performance tolerances and retry rules in the reviewed contract; retries must not erase failures or cherry-pick a green run. Design quality and ambiguous product behavior may still require human judgment. Record that as a human gate rather than disguising an LLM opinion as a deterministic predicate.

Measure progress by recurring manual/model checks replaced with reliable executable checks, failures caught before review and goals completed with current evidence. Do not optimize for check count or a green dashboard. The desired loop is **discover an invariant → encode a check → prove it catches failure → enforce it → build the next capability using that check**.

## Progressive validation ladder

Roll out validation in this order, retaining earlier layers as later ones are added:

| Level | Introduce when | Required behavior |
|---|---|---|
| 1 — Lint and type checking | Tier 0 repository/toolchain setup | Fast local and PR feedback for actual source/configuration; stable CI check names and pinned tools. Keep attribution hooks from the outset. |
| 2 — Unit tests | Tier 1 introduces executable domain/policy logic | Test invariants, edge cases and failure behavior in isolation; deterministic fixtures. Add tests alongside the behavior, not after a separate test-writing phase. |
| 3 — Integration tests | Tier 2 connects real broker, worker and runtime components | Verify contracts across process/storage/provider boundaries, restart/reconnect and isolation. Run relevant fast checks on PRs and required merge-group checks on the candidate revision. |
| 4 — Review agents | Real changes and stable check evidence are available | Analyze design/security/maintainability and missing cases, returning actionable findings tied to the exact diff. Findings feed repair or new checks; they do not substitute for tests or Kirk's approval. |

This is a progression in automated coverage, not permission to defer safety checks. Tier 0 still verifies the actual hooks, sandbox and development environment it introduces, even though broad application integration suites arrive later. Each component receives appropriate verification as it becomes real; no empty test suite or placeholder green job counts as acceptance evidence.

Begin with a small fast lane: formatting/lint, type checking and a real build where present. Add focused unit tests before growing cross-component suites. Separate slow/runtime-dependent tests with explicit required/optional status and a compatible runner. Keep required checks available to the merge queue; never hide a required failure behind a skipped aggregate job or an advisory review.

Review agents should read the diff, relevant design constraints and recorded check results with bounded context and read-only repository access. Review comments and permission to publish them follow the configured GitHub authorization path. Run reviewers separately from secret-bearing metadata automation; review-agent execution must not expose credentials to candidate code. Prefer initially on-demand review before making it a standard PR stage, and evaluate usefulness and false positives.

Use structured review findings: source revision, affected file/behavior, severity, evidence, suggested validation and disposition. A trusted process validates report structure and freshness; the substance remains probabilistic. An unavailable reviewer is recorded as unavailable, not as an empty successful review. If review is required by policy, its absence blocks that gate. Resolve material findings through code/tests or an explicit reviewed explanation; the agent cannot self-approve an exception.

When a reviewer repeatedly detects a mechanically checkable issue, convert it into a lint rule, unit test, integration assertion or goal predicate with positive/negative examples. Keep nuanced design judgments in review. This closes the capability-building loop: **fast deterministic checks → behavioral tests → system tests → agent critique → new deterministic regression checks**.

## Priority: semi-autonomous implementation on Fedora first

**First operational milestone:** use OpenShell and isolated development workloads on the current Fedora development box to perform a bounded implementation task with Pi, producing a tested, reviewable PR. Reach this before building the full dashboard, multi-runtime fleet, team edition or general dynamic scheduler. Semi-autonomous means independent inspect/edit/test/repair within an approved task and budget, with Kirk retaining tier review and required authority decisions.

Preserve the selected micro-VM default for autonomous workers: use an OpenShell VM-backed sandbox running the development userspace/container image when supported on the actual Fedora machine. Validate that path in Tier 0. A direct OpenShell/rootless-Podman container is a distinct shared-kernel profile, not an equivalent VM boundary; do not silently substitute it. If the VM path is blocked, report the concrete missing prerequisite and propose an explicit scoped alternative.

### Shortest dependency path

1. **Tier 0 foundation:** working attribution hooks, pinned Pi/toolchain and image, minimal lint/type/build CI, a verified Fedora OpenShell development sandbox and reproducible start/recreate instructions. Probe OpenShell/Pi control early. Keep each PR small and stop for Kirk's tier review.
2. **Tier 1 minimum control contract:** stable task/workspace IDs, narrow action/policy boundary, recorded run state, bounded outputs and revision-bound evidence. Use upstream components and simple adapters. Do not design a universal provider framework before it has a real consumer. Obtain tier acceptance.
3. **Tier 2 semi-autonomous task:** run one Pi implementation worker inside the verified sandbox with the approved model route, writable isolated checkout and focused checks. Let it inspect, edit, test and repair up to a stated limit, then return the diff/test evidence for GitHub review. Reconcile after disconnect and preserve its checkpoint. PR publication uses the trusted forge path with applicable authorization; no broad GitHub credentials in the worker.

For the first Tier 2 loop, use upstream Pi's existing task/tool behavior and a small externally supervised run with explicit limits and durable checkpoints. It need not wait for Workbench's general workflow engine. Do not mislabel this minimal supervision as the later durable dynamic scheduler: supported recovery and cancellation must be demonstrated, and unsupported behavior shown explicitly.

Defer rich TUI work, remote delegation, AgentCore, multi-tenant inboxes and arbitrary dynamic graphs until this milestone works. Basic status, logs, task input, cancellation and review evidence are sufficient. Expand deterministic verification alongside the real components: lint/type checks first, unit checks for core behavior, then necessary OpenShell/worker integration and boundary checks. Review agents can follow; they are not required to enable the first bounded loop.

### Milestone acceptance

On Fedora, start a preselected small implementation task through the approved OpenShell profile; demonstrate an edit, a focused test and a bounded repair if needed. Show source revision, actual sandbox identity, model/data route, budget use and final diff. Prove that the worker cannot reach unrelated host paths/credentials or bypass required host-native approvals. A client interruption must not duplicate the job; a failed check or exhausted limit produces a clear checkpoint/blocker, not false completion. Deliver the PR or a prepared review package if publication is not yet configured.

This milestone makes Pi useful for building subsequent capabilities immediately. The later coordinator and extension-promotion loop strengthen automation incrementally rather than becoming prerequisites for all useful autonomous work. Preserve a known-good external launcher and human recovery path throughout.

## Runtime placement: native locally, clusters remotely

Use the native OpenShell MicroVM driver on Fedora/Linux and macOS. Reserve Kubernetes/OpenShift/OKD with OpenShell and Kata/Sandboxed Containers for remote clusters, including home OKD controlled from the MacBook. Do not install or retrofit Kind/KubeVirt as a local worker prerequisite. Prior virtualization experiments are evidence only; preserve existing workloads.

Tier 0 validates the native Fedora VM path: pinned package/driver contents, explicit `vm` selection, virtualization access, scoped firewall/TAP networking, image prerequisites, guest boot, storage lifecycle, resource bounds, denied host/credential access and authenticated gateway execution. A failed VM setup must pause dependent work rather than silently select Podman/Docker. Local rootless Podman remains available for its separately scoped toolchain role. Credentialed workers require design §14.3 tests; use synthetic secrets first.

Tier 6 handles remote cluster placement and Belt ownership, with pinned controllers/charts, platform policy, quotas and independently verified Kata isolation. The successful rootful Kind spike is useful compatibility evidence, not remote OpenShift production qualification or a supported local placement. Rootless Kind was not retested after the shared-memory discovery.

## Completed runtime spike

OpenShell 0.0.116 executed commands inside separate Kata 4.1.0 Go/QEMU and Rust/QEMU guests after increasing disposable-node shared memory from about 63 MiB to 8 GiB and adding `iproute2` to the minimal probe image. See KATA-SPIKE.md. Record memory admission and image prerequisite checks as deterministic tests where applicable. Native OpenShell MicroVM still needs its own host smoke test.

## Review contract

Each tier ends with Kirk's review in GitHub. Work on feature/bugfix branches and open a reviewable PR with the problem, resulting behavior, scope, validation evidence, limitations and focused review notes. Never commit implementation directly to main/master/trunk. A tier may use several small PRs; identify their dependencies and the final tier acceptance checklist. Do not submit a giant PR containing several tiers.

Pi may autonomously implement and repair work inside the authorized tier. It must stop at the review gate, checkpoint progress and await Kirk's approval before dependent implementation begins. Passing CI or another agent's review is not Kirk's approval. After approval, follow the repository's merge policy; approval alone does not authorize Pi to merge or publish. Dependent work starts from the accepted base after merge by the authorized party. Track material revisions and obtain renewed review when they invalidate the approval.

No GitHub repository, branch, workflow or PR is created by adopting this plan. Confirm the implementation repository when starting the work. Follow its additional instructions and branch protections.

## Tier 0 — Establish the development foundation

**First implementation PR: hooks, CI, toolchain, development environment and sandbox.** This is a working foundation, not a documentation-only checklist and not an implementation of the whole broker.

1. Inspect the selected repository and define the minimal package layout, supported initial machine/architecture and pinned Pi/runtime/toolchain versions. Record unresolved compatibility questions explicitly.
2. Install/configure the existing attribution hooks through their supported path. Preserve Kirk's DCO workflow: provide the required Codex co-author input and let the hooks generate `Assisted-by` and `Signed-off-by`. Never write those generated trailers manually or disable hooks. Verify on a disposable repository/branch, including rejection cases. If a hook blocks legitimate work, report it rather than bypass it.
3. Pin dependency and package-manager versions, commit lockfiles, and define documented format, lint, typecheck, test and build entrypoints. Avoid invented passing checks for components that do not exist yet; identify which checks cover the actual skeleton and expand them with code.
4. Provide a reproducible development image/environment and one working micro-VM development sandbox, initially on the chosen Linux host. Use approved immutable image inputs, scoped source mounts/storage, resource bounds and a documented start/stop/recreate path. Keep credentials and host engine/approval sockets outside the untrusted workload. Document macOS setup and any unverified architecture differences honestly.
5. Add GitHub Actions for reproducible install and relevant source/build checks, plus hook/attribution validation where implementable independently of local hooks. Use least-privilege workflow permissions, pinned action revisions and no secret-bearing execution of untrusted PR code. Cache only appropriate build inputs, not credentials or runtime state. Define the required-check names for repository protection; enabling protections may require repository-admin action.
6. Add sandbox conformance checks: expected writable paths, denied credential/sibling-checkout access, required isolation, persistence through recreation and clean failure when prerequisites are missing. A container-only CI runner cannot prove micro-VM isolation. Run virtualization checks on a suitable disposable/isolated runner or the development host and attach recorded evidence; do not expose a persistent credential-bearing self-hosted runner to untrusted PRs.
7. Add contributor instructions, bootstrap/troubleshooting commands, environment/version diagnostics, ignored state paths and a short recovery procedure. Test from a fresh clone in the supported environment.

**Exit evidence:** clean-clone setup; hook success/rejection behavior; CI results; actual sandbox identity/configuration and boundary tests; reproducible build; documented prerequisites and remaining platform gaps.

**Kirk reviews:** trusted installation paths, hook preservation, CI permissions, dependency pins, image provenance, sandbox mounts/network/identity and ease of local setup. No real corporate credentials or production access are needed for this tier.

## Tier 1 — Contracts and deterministic core

Map to B1/B2. Implement domain IDs, shared action schemas, context generations, local registry, output/artifact handles and a fake execution provider. Add preparation, policy-decision and approval-binding contracts with fixture identities and evidence. Provide a minimal inspection CLI/test client before expanding UI.

**Exit evidence:** invalid context denied, durable state reopening/migration tests, profile separation, altered/expired approval rejection, bounded outputs and duplicate request reconciliation.

**Kirk reviews:** domain/API clarity, authority boundaries, state ownership and whether the minimal contracts support a real task without unnecessary framework code.

## Tier 2 — First semi-autonomous Fedora implementation worker

Map to B3/B4. Connect the verified sandbox provider to the trusted action path, add the Pi worker bridge and minimal extension/client, then execute a bounded inspect/edit/test task. Use stable workspace identity and revision-bound results. Keep host-native access denied except explicit reviewed capabilities.

**Exit evidence:** real task result, isolation failures tested, cancellation semantics, client reconnect without duplicate start, preserved source and reviewable diff/test evidence.

**Kirk reviews:** actual versus simulated behavior, Pi integration choice, worker credential boundary and the complete local experience. This tier may expose API limitations that justify a narrowly scoped SDK/client change; document that before introducing a fork.

## Tier 3 — Daily-use workbench and read-only integrations

Build Home/inbox, Work switching, tmux restoration, independently scrollable review and local feedback. Add pinned skill discovery and explicit model handoff. Introduce forge descriptions/CI or other read adapters only after their identity boundary passes its own checks; use clearly labeled fixtures otherwise.

**Exit evidence:** restart/resume without reconstructing context, focus/scroll/resize behavior, revision-safe review drafts, profile-scoped source freshness and no silent model/provider fallback.

**Kirk reviews:** real terminal usability against the mockup, shortcut/plain-English parity, information density and useful daily behavior.

## Tier 4 — Bounded workflows and capability construction

Include the disposable-Pi extension test and promotion loop in BOOTSTRAP.md. Prove isolated candidate loading, deterministic verification, exact-artifact installation, checkpointed main-instance reload/restart and rollback before automated reuse. Main-instance promotion must remain within the current tier’s authority; it cannot substitute for Kirk’s acceptance.


Map to B5 then B6. Start with a durable linear inspect/edit/test loop. Add budgets, no-progress detection, external waits, recovery and cancellation before dynamic graph changes. Then implement the bootstrap capability-building loop: identify a concrete missing tool, build/verify it, admit an approved version and resume its consumer.

**Exit evidence:** restart at dispatch/result boundaries, no duplicate side effects, enforced attempt/time/cost limits, independent acceptance checks and rejected graph/permission expansion. Demonstrate one newly built capability reused by a later task.

**Kirk reviews:** autonomy bounds, tool promotion, checkpoint behavior and recovery. The candidate cannot grant itself privileges or approve this tier.

## Tier 5 — Remote SSH delegation and the physical bench

Add destination-side supervised jobs/agents on one enrolled SSH PC. Apply strict host-native capability policy. Implement the Mac → RPi → QNX/Android workflow first with bounded identity/diagnostic/log operations using verified device protocols. Add mutations only in a separate reviewed increment with target verification and recovery.

**Exit evidence:** disconnect/reconnect to the same run, stale-writer prevention, wrong-host/target rejection, bounded bench logs and preserved unpublished results.

**Kirk reviews:** commands replacing today's scripts, target safety, token reduction, network separation and destination recovery.

## Tier 6 — Cluster and managed-cloud placements

Use separate PRs for OpenShift/OpenShell/Kata, home OKD and AgentCore; implement one end to end before the next. Finalize Belt/GitOps ownership only from inspected contracts. Reuse common dispatch while validating provider-specific identity, storage, lifetime and capabilities. Browser/editor profiles are enabled only on providers that pass their conformance checks.

**Exit evidence:** one locally launched remote task per enabled backend, result/review retrieval, reconnect, cleanup preservation, identity/egress checks, runtime boundary and lifecycle-owner agreement.

**Kirk reviews:** provider differences, infrastructure scope/cost, reproducibility, home/work separation and any experimental constraints. Infrastructure changes require their own concrete review/authorization.

## Tier 7 — Team distribution and controlled self-hosting

Map to B7. Package the shared core, private team defaults and version-pinned launcher; verify Bedrock/local routes, private image/package registries, theme and per-user onboarding. Use the last accepted Workbench release to build candidates in separate state/sockets/sandboxes. Retain an independent recovery path.

**Exit evidence:** fresh teammate setup, compatibility and upgrade/migration checks, profile isolation, candidate rollback/recovery and completed user workflows.

**Kirk reviews:** install simplicity, maintenance burden, update ownership and readiness for internal distribution. A branded launcher or fork is never the security boundary.

## Per-PR evidence template

- Problem and resulting behavior, linked to the tier and design decision.
- Included work and deliberately deferred dependencies.
- Exact source revision, environment/toolchain/image versions and relevant checks.
- Reproduction steps and artifacts; simulated versus real behavior called out.
- Security/state migration implications and recovery procedure where relevant.
- Two or three areas worth Kirk's closest attention.
- Outstanding tier checklist items and the next proposed PR.

## Dynamic workflows under review gates

A tier is the outer authorization boundary. Pi may split tasks, insert bounded capability subgoals and repair failures inside it, preserving the original acceptance criteria. Missing dependencies from later tiers become proposals or explicitly reviewed scope changes, not implicit permission to implement ahead.

Use a final `await-human-review` gate with evidence and PR references. Record the reviewed revision, reviewer decision and accepted merge/base revision before unlocking dependents. Keep external review/merge observations distinct from agent assertions. While awaiting review, Pi may summarize results or respond to feedback; it must not start dependent implementation. No background automation or GitHub messaging is configured by this document.

## Stacked PRs, merge queues and GitHub Actions

Use small stacked PRs **within the currently authorized tier**. Each layer addresses one reviewable dependency and has its own issue, acceptance evidence and incremental diff. Do not stack later tiers on unapproved work to evade the phase gate. Independent tasks can use independent branches rather than becoming artificial stack dependencies.

Prefer GitHub's stacked-PR support and the pinned `gh stack` extension where available. GitHub documents stack-aware review/merge behavior and merge-queue integration. Verify repository/organization availability and tool compatibility in Tier 0; if unavailable, propose explicit branch-chain PRs and a documented restack procedure. Do not silently introduce another hosted stack service. [GitHub stacked PRs](https://docs.github.com/en/pull-requests/get-started/about-stacked-prs)

Recommended Tier 0 stack:

1. Repository skeleton, contributor rules, toolchain pins and attribution-hook setup.
2. Reproducible development image and sandbox lifecycle, based on layer 1.
3. GitHub Actions, conformance checks and merge-queue readiness, based on layer 2. Include minimal CI in layer 1 so early layers have checks.
4. Task-board synchronization, clean-install evidence and the tier acceptance record, based on the verified foundation.

Queue only the approved, eligible portion of a stack. Keep upper layers blocked when a lower layer fails or changes. Revalidate attribution and review requirements after restacking; rewritten revisions may need new evidence and review. Do not assume a stack lands atomically. Reconcile GitHub's actual merged heads, queue entries and remaining branch relationships rather than guessing from local branch names.

Required Actions checks must run for both `pull_request` and `merge_group` (`checks_requested`). Test the queue's supplied merge-group revision rather than checking out a PR head manually. Stable required-check names and reliable final status reporting prevent skipped jobs from leaving the queue stuck. GitHub explicitly requires the additional event for Actions checks used by merge queues. [Merge-queue configuration](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue)

Protect the accepted base using required reviews/checks and queue rules supported by the repository plan. Check availability before promising enforcement. Pi may prepare queue-ready PRs and repair failures in its current tier; Kirk or an explicitly authorized automation enqueues them. The queue merges eligible changes under configured rules. Neither enqueue nor green CI counts as the final tier acceptance: record Kirk's phase review and the accepted merged revision before unlocking the next tier.

Use separate validation and metadata-automation workflows. Validation executes candidate code without repository-writing credentials. Metadata automation handles board/PR observations through a narrowly scoped identity, without checking out or executing PR code. Never use `pull_request_target` with privileged credentials to run an untrusted branch. Do not treat server-generated merge commits or squash commits as if local hooks executed on them: choose and test a merge strategy that preserves the required attribution/DCO policy, and surface incompatibility before enabling it.

## Harness-maintained implementation board

Use **GitHub Issues and a GitHub Project as the shared review-facing board**. Pi maintains tasks through a trusted adapter; the harness displays the same items with live run/evidence links. Avoid creating an independent competing to-do database. The workflow coordinator owns execution state; GitHub owns issue/PR/review/merge state; the Project displays the reconciled planning view.

GitHub Projects exposes APIs and built-in automation for issue/PR items and fields. Configure automation deliberately: default closed-item transitions are not sufficient to prove that an implementation task met its acceptance criteria. [Projects API](https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/using-the-api-to-manage-projects), [built-in workflows](https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/using-the-built-in-automations)

Suggested fields: stable task ID, tier, status, priority, dependency IDs, capability gap/consumer, owner, Work/Workspace/run reference, stack/PR references, evidence revision and blocker reason. Suggested statuses: **Proposed, Ready, In progress, Verifying, Awaiting review, Changes requested, Queued, Merged, Blocked, Cancelled**. Keep tier acceptance as a distinct milestone/gate record; a merged task alone does not approve the tier.

Pi may discover a missing capability, search existing tasks, add a deduplicated proposal, link its consumer and schedule it when its dependencies and current-tier scope permit. Each generated task needs a concrete outcome and evidence-based acceptance criteria. Cross-tier work remains Proposed/Blocked until authorized. Creating a card does not allocate resources, publish code, grant privileges or modify acceptance requirements.

At bootstrap, use a checked-in board seed and a human-readable progress ledger. Add trusted GitHub synchronization in Tier 0 after repository/project selection and credentials are configured. Use an explicit idempotency mapping between local task IDs, issue node IDs and project item IDs. Reconcile source revisions/events and paginate queries. On API failure, show stale/pending state and retry with backoff; do not duplicate issues or infer that a PR has merged. Use a separately scoped GitHub App or supported token for Projects operations; do not assume the repository's default workflow token can manage an organization Project.

Maintain a **Current tier** view for implementation, a **Needs Kirk** view for review/decisions, a **Dependency view** for blockers and a **Capability backlog** for tools Pi proposes building. Show future tiers for planning without activating them. Pi updates factual status and evidence, preserves human edits to priority/scope, and reports meaningful blockers without posting repetitive comments. Live creation, comments and notification policy are configured for the selected repository during implementation; this handoff creates no external board or messages.

### Initial board seed

| ID | Tier | Task | Depends on | Initial state |
|---|---|---|---|---|
| BOOT-001 | 0 | Select repository and confirm GitHub stack/queue capabilities | — | Ready |
| BOOT-002 | 0 | Pin toolchains and configure attribution hooks | BOOT-001 | Blocked |
| BOOT-003 | 0 | Build reproducible development image and micro-VM environment | BOOT-002 | Blocked |
| BOOT-004 | 0 | Add PR/merge-group CI and boundary checks | BOOT-002, BOOT-003 | Blocked |
| BOOT-005 | 0 | Configure scoped board synchronization and seed issues | BOOT-001, BOOT-002 | Blocked |
| BOOT-006 | 0 | Assemble fresh-install evidence and request tier review | BOOT-003, BOOT-004, BOOT-005 | Blocked |
| CORE-001 | 1 | Implement domain/action/state contracts against a fake provider | Tier 0 accepted and merged | Proposed |

Treat these as seed tasks, not already-created GitHub issues. The graph can expand with concrete discovered dependencies; only the approved tier becomes executable.
