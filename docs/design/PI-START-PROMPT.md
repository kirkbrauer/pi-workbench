# Pi Workbench: begin Tier 0

You are helping Kirk build Pi Workbench, a personal engineering control plane implemented as composable Pi extensions/packages with a separately trusted execution broker.

Read START-HERE.md, CURRENT-STATE.md and FIRST-MILESTONE.md first. Then read IMPLEMENTATION-TIERS.md and the relevant sections of DESIGN.md and BOOTSTRAP.md. Treat the HTML mockup as an interaction reference; its integrations and actions are simulated.

Start with **Tier 0 only**: repository foundation, attribution hooks, pinned toolchains, lint/type checks, GitHub Actions, reproducible development image and a verified native OpenShell MicroVM sandbox on this Fedora host. Do not build the full UI or workflow engine first. Native OpenShell VM execution has not yet been tested here. Local Kind and KubeVirt are not prerequisites; Kubernetes is reserved for remote clusters.

Inspect the current directory and repository instructions before making changes. If no implementation repository has been selected, ask Kirk for its path or intended new repository; do not treat this reference bundle as the implementation repository. Meanwhile, read the handoff and identify concrete prerequisites. Work on feature branches and preserve existing attribution hooks. Follow the actual repository's commit attribution requirements; never bypass hooks or invent attribution for another agent.

Use small stacked PRs, with lint/type checks on pull requests and merge-group revisions. Verify repository support for merge queues and required checks before configuring them. Each tier ends with Kirk's GitHub review and an approved, merged base before dependent implementation starts. A queued PR or a model review is not tier acceptance.

Use investigation to discover requirements, then encode reviewed deterministic preflights, hooks, CI checks and goal predicates. Add unit tests when behavior exists, integration tests when real boundaries exist, and review agents when meaningful diffs exist. Keep immediate sandbox boundary checks mandatory. Bind completion evidence to the tested revision and configuration; never weaken checks to declare success.

Keep personal/work identities separate. Do not mount the host home, Codex credential cache, SSH agent, keyring or container-engine socket into an untrusted worker. Read DESIGN.md §14.3 before implementing Codex access. Use synthetic credentials for initial tests; real enrollment is a trusted human flow. Host execution and installation remain governed by explicit capability and approval policy. Preserve existing host security settings and workloads.

Produce the smallest working Tier 0 increment with setup/recovery instructions and acceptance evidence. Record progress using the lightweight board described in FIRST-MILESTONE.md. Use upstream Pi plus ordinary scripts until verified harness capabilities exist; illustrative workflow YAML is not an executable engine. Later, test extension candidates in isolated child Pi instances before exact-artifact promotion and main-instance reload.

Begin by reporting the selected repository, inspected toolchain/runtime state, the first small change, and any concrete missing input. Complete authorized work without repeated confirmations. Stop at the tier boundary with reviewable PRs, evidence and a clear handoff using REVIEW-HANDOFF.md.
