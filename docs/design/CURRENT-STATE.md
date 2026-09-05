# Current state for the implementing agent

September 5, 2026 • architecture baseline 1.27

## What exists

This bundle contains the architecture, staged implementation plan, bootstrap dependency plan, browser mockup and editable mockup source. It is reference material, not a production harness. No implementation repository has been selected in this handoff. Private Belt Build repositories have not been inspected. Do not invent their resource schemas.

## Decisions to preserve

| Area | Baseline |
|---|---|
| Local workers | Native OpenShell MicroVM on Fedora/Linux and macOS; verify each platform independently. |
| Remote clusters | OpenShell with Kata/OpenShift Sandboxed Containers on remote OpenShift/OKD/Kubernetes. Home OKD controlled from a MacBook fits this path. |
| Local Kind | Completed compatibility experiment only; not a worker runtime or bootstrap dependency. |
| Direct local/SSH commands | Stricter, explicitly scoped broker permissions, including human-controlled sudo. |
| Configuration | Project contract → private org platform policy → GitOps workspace instances → observed runtime registry. Belt owns managed remote-workspace lifecycle. |
| VCS | Git canonical for publication; local Jujutsu supported behind a VCS abstraction. |
| Distribution | Composable Pi packages plus a private team launcher/configuration; justify a fork only if upstream interfaces cannot meet a concrete requirement. |
| Bootstrap | Tier 0 foundation, Tier 1 contracts, Tier 2 first bounded implementation worker; Kirk reviews every tier in GitHub. |
| Credentials | Host-owned credential domains; no wholesale host auth-directory sharing. Codex delivery modes need explicit validation. |

## Verified experiment

OpenShell 0.0.116 and Kata 4.1.0 ran successfully in a disposable rootful Podman Kind cluster. Both Go/QEMU and Rust/QEMU sandboxes executed commands through OpenShell, reported guest kernel 6.18.35 and distinct boot IDs from the host and each other.

The guest startup failure was resolved by increasing the test node's full shared-memory mount from roughly 63 MiB to 8 GiB. A second failure was resolved by adding `iproute2` to the minimal Ubuntu image. Read KATA-SPIKE.md for scope, configuration and evidence. These fixes do not qualify every platform or image.

The disposable cluster and isolated client credentials/kubeconfigs were removed. Image caches may remain. Existing Belt containers were preserved. Reinspect machine state; do not assume the old test gateway still runs.

## Not yet verified

- Native OpenShell MicroVM boot, networking, persistence, resource limits and policy on Fedora; all native macOS behavior.
- A real Pi implementation worker running in that sandbox.
- Real Codex auth delivery, refresh, revocation or inference. The spike passed no model credentials.
- Production OpenShift security conformance, corporate identity, JFrog access or Belt integration.
- Full sandbox attack/bypass testing. The probe supervisor warned of an unlimited PID budget.
- Repository rules, Actions execution and merge queue availability for the eventual implementation repository.

The test gateway used mTLS transport and explicit local-development unauthenticated-user mode. Do not carry that user-auth setting into a shared deployment. Passing guest startup is not passing these remaining checks.

## Supporting references

Current upstream interfaces can change. Verify the versions actually installed rather than copying latest-documentation examples blindly.

- [OpenShell installation](https://docs.nvidia.com/openshell/latest/about/installation)
- [OpenShell compute drivers](https://docs.nvidia.com/openshell/latest/reference/sandbox-compute-drivers)
- [Codex authentication](https://learn.chatgpt.com/docs/auth)
- [Codex app-server](https://learn.chatgpt.com/docs/app-server)
- [Pi containerization](https://pi.dev/docs/latest/containerization)

OpenShell documents opt-in `compute_drivers = ["vm"]`; VM is not auto-detected. Verify native package contents and actual guest sizing. Codex external ChatGPT token mode is experimental and requires a host that owns the auth lifecycle; it is not a workspace-scoped token minting API.
