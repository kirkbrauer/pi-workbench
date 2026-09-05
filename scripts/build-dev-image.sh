#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
# Build only a clean committed snapshot: ignored auth, .local and .git never enter context.
test -z "$(git status --porcelain)" || { echo 'Commit/review the candidate before building its image.' >&2; exit 1; }
revision=$(git rev-parse HEAD)
epoch=$(git show -s --format=%ct HEAD)
mkdir -p .local/evidence
image="localhost/pi-workbench-dev:$revision"
git archive --format=tar HEAD | podman build --file dev/Containerfile \
  --cap-drop=ALL --memory=2g --cpu-period=100000 --cpu-quota=200000 \
  --timestamp "$epoch" --rewrite-timestamp --label "org.opencontainers.image.revision=$revision" \
  --iidfile ".local/evidence/dev-image-$revision.id" --tag "$image" -
podman run --rm --network=none --read-only --cap-drop=ALL --security-opt=no-new-privileges \
  --pids-limit=256 --memory=2g --cpus=2 --tmpfs /tmp:rw,nosuid,nodev,size=256m \
  --tmpfs /home/node/workbench:rw,nosuid,nodev,uid=1000,gid=1000,mode=0700,size=1g "$image"
printf 'tested source=%s image=%s\n' "$revision" "$image"
