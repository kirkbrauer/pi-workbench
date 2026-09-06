#!/usr/bin/env bash
set -euo pipefail
cd "${WORKBENCH_CHECKOUT:-$(dirname "$0")/..}"
# Temporary trusted toolchain helper. Not a worker VM. Only this checkout is shared.
image='docker.io/library/node@sha256:4d676821dff059fd00d277ee4261ef34ea712317fed0737c03941481b5760c96'
exec podman run --rm --userns=keep-id --user "$(id -u):$(id -g)" \
  --cap-drop=ALL --security-opt=no-new-privileges --read-only \
  --pids-limit=256 --memory=2g --cpus=2 \
  --tmpfs /tmp:rw,nosuid,nodev,size=512m \
  -e HOME=/tmp -e COREPACK_HOME=/tmp/corepack -e CI=true \
  -v "$PWD:/workspace:Z" -w /workspace "$image" \
  sh -eu -c 'mkdir -p /tmp/bin; corepack enable pnpm --install-directory /tmp/bin; export PATH="/tmp/bin:$PATH"; exec "$@"' sh "$@"
