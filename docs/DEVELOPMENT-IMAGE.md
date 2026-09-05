# Reproducible toolchain environment

`dev/Containerfile` uses the immutable linux/amd64 Node 22.23.2 base, exact
Corepack/pnpm package-manager pin and frozen workspace lock. The image contains a
single committed source snapshot and its dependency installation/build, not host
home, auth, Git metadata, SSH/keyring sockets or a container-engine socket.

```sh
bash scripts/toolchain.sh pnpm install --frozen-lockfile --ignore-scripts
bash scripts/toolchain.sh pnpm check
bash scripts/toolchain.sh pnpm audit --audit-level high
# Once source is committed and the worktree is clean:
bash scripts/build-dev-image.sh
```

The first helper is the former temporary Podman command, now a reusable script.
It explicitly mounts ONLY the selected trusted checkout with private SELinux
labeling. It does not forward host credentials/environment and uses bounded
rootless execution. Do not use it for arbitrary untrusted worker code.

The image builder feeds **git archive HEAD**, never the entire working directory,
to rootless Podman. It fails on uncommitted/untracked source. The build downloads
public packages with scripts disabled; inputs undergo the same source/lock checks.
The smoke run is offline, non-root, read-only root, no capabilities, no-new-privileges,
2 CPU/2 GiB/256 PIDs, and a bounded scratch copy for compiler output. Its image ID
is recorded under `.local/evidence/dev-image-<SHA>.id`. The source revision is also
an image label. An image digest is evidence only after its actual build/run.

Timestamps are normalized, but no byte-identical rebuild claim is made without
comparing independently built artifacts. Registry/advisory metadata is deliberately
revalidated and can block later installs. This environment is reproducible input
selection, not immunity from revoked packages or network outages.

This is shared-kernel **toolchain isolation**, NOT the autonomous worker boundary.
The native OpenShell probe used a separate upstream image and has failing
qualification predicates in `NATIVE-VM.md`. The Workbench image has not been
qualified inside native OpenShell. macOS/arm64 images are not verified.

Recovery: keep the source checkout; remove only the explicitly identified temporary
image if unwanted. Never prune other containers/images or delete unpublished
workspace data. Private JFrog/CA profiles require separate qualification described
in `REGISTRIES-AND-CA.md`; no registry credentials are baked into this image.
