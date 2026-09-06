#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
umask 077
root="$PWD/.local/openshell"
mkdir -p "$root/downloads" "$root/bin" "$root/home"
fetch() {
  local name="$1" sha="$2"
  if ! test -f "$root/downloads/$name"; then
    curl --proto '=https' --tlsv1.2 -fLsS --max-time 120 \
      "https://github.com/NVIDIA/OpenShell/releases/download/v0.0.116/$name" -o "$root/downloads/$name"
  fi
  printf '%s  %s\n' "$sha" "$root/downloads/$name" | sha256sum --check --status
  tar -xzf "$root/downloads/$name" -C "$root/bin"
}
fetch openshell-x86_64-unknown-linux-musl.tar.gz 4fb4476d80a1875a0b83547ec3aba999cf0a2e2d75f95f2f709b622e2103520e
fetch openshell-gateway-x86_64-unknown-linux-gnu.tar.gz 59c6da724eae7a00c28826f9191efbdf4fbaa5c768afdc8dea6a80a949ebcc89
fetch openshell-driver-vm-x86_64-unknown-linux-gnu.tar.gz 926eb67e5f35028f84610d24a35f0333dfa2f0d6e5b264b82732d6aaf4f97339
for bin in openshell openshell-gateway openshell-driver-vm; do
  env -i HOME="$root/home" PATH="$root/bin:/usr/bin:/bin" "$root/bin/$bin" --version
  env -i HOME="$root/home" PATH="$root/bin:/usr/bin:/bin" "$root/bin/$bin" --help > "$root/$bin-help.txt"
done
