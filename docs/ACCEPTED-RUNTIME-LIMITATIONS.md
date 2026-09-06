# Accepted native-runtime limitations

## Decision — 2026-09-06

Kirk explicitly accepted **Landlock being unavailable** and **raw-stop persistence
issues** in the native OpenShell profile. Record these as accepted limitations,
not as passing enforcement/durability checks. Do not keep presenting repair of
these two limitations as an unconditional prerequisite for further scope review.

This records the conversation decision for GitHub review. It is not a claim of
full Tier 0 acceptance, worker admission, or approval of unrelated missing controls.
No runtime/policy/check implementation is changed by this decision record.

## Landlock

- Native Fedora observed Landlock EOPNOTSUPP (95); native macOS observed ENOSYS (38).
- Best-effort operation is accepted without claiming Landlock filesystem access
  enforcement. Policy path lists must not be represented as enforced by Landlock.
- Native VM separation still exists; it is distinct from filesystem restrictions
  within the guest. Do not infer that accepting one missing control proves the
  rest of the credential/filesystem boundary.
- The strict Landlock profile remains unsupported on these tested runtimes; its
  Provisioning timeout remains recorded. Do not downgrade a requested strict
  policy silently or call that timeout a clean terminal rejection.

## Raw stop and cooperative checkpoints

- Raw stop/start lost unflushed synthetic markers on both platforms. This behavior
  is accepted; raw stop/forced termination does **not** promise persistence.
- The tested persistence path is cooperative: quiesce trusted work, execute guest
  `sync`, stop/start, and verify exact marker contents plus a changed guest boot ID.
- This is not atomic quiescing, protection against concurrent writers, or a
  guarantee after crashes/forced exits. If the cooperative sequence fails, report
  failure/uncertainty; never fall back to raw stop and report checkpoint success.
- Preserve useful source/checkpoints and publish intended Git changes through the
  ordinary reviewed path. Do not treat this acceptance as permission to discard
  unpublished work or assume remote sessions are durable.

## Still separate and unresolved

- Guest PID budget is absent. Host-level caps are not proof of a guest PID budget;
  the Mac helper also lacks aggregate host CPU/RAM/PID quotas.
- Credential/provider enrollment and comprehensive filesystem/network boundary
  qualification have not been performed. Narrow synthetic probes are not general
  conformance evidence. No real account enrollment is allowed in current Tier 0.
- Workbench development userspace has not been qualified inside native OpenShell.
  Remote Pi supervision, reconnect/deduplication and update activation are not
  implemented or verified.
- No broker, credentialed/untrusted worker, UI or workflow-engine admission follows
  from accepting these two limitations. Other predicates and the tier-review gate
  still apply; do not broaden this decision silently.

## Evidence remains unchanged

See [Fedora native evidence](evidence/native-spike.txt),
[macOS E2E](MACOS-E2E.md) and [bound Mac evidence](evidence/macos-e2e.txt).
Successful Mac native runs tested Workbench
`bf4a177bb407642b6e452937d687971a36285d96`; the evidence records exact artifact,
configuration, image and runtime identities. Fedora evidence records its source
base and component/configuration hashes separately. These runs were not repeated
for this documentation decision.

Keep the original failure outcomes, raw-stop loss and checkpoint success intact.
The distinction is **observed failure, accepted limitation**, not a rewritten test
result. Future profile/acceptance revisions must cite this decision and independently
verify the remaining required controls at their actual candidate revision.
