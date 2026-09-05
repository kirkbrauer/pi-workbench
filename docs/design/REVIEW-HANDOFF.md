# Review handoff template

Copy this into each tier's review record and fill every field with evidence or an explicit remaining gap. Do not report planned tests as completed tests.

## Outcome

- Tier and intended user-visible outcome:
- What changed and why:
- What Kirk should inspect most closely:

## Revisions and dependencies

- Repository, feature branch and commit:
- PR stack in dependency order:
- Tested source/merge revision:
- Image digests, runtime versions and configuration fingerprint:
- Previous accepted tier/base:

## Verification

| Acceptance predicate | Check/run link | Revision/configuration | Result or remaining gap |
|---|---|---|---|
| Fill from this tier's plan | | | |

## Operational impact

- Host or external resources changed:
- Credential domains used (metadata only):
- Isolation/resource limits observed:
- Persistent data and cleanup status:
- Rollback/recovery steps:

## Review and next action

- Unresolved risks or blockers:
- Kirk's review status:
- Merge/queue status:
- Next authorized tier or task after acceptance:
- Commands/context needed to resume, without credentials:

Keep the next agent's context concise. Attach bounded logs or artifact links rather than raw session transcripts. A review agent's opinion supplements test evidence and Kirk's review; it does not replace either.
