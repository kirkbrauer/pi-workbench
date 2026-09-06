#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
umask 077
root="$PWD/.local/openshell"
export PATH="$root/bin:/usr/bin:/bin"
# A CLI timeout is not VM cleanup; stopped/failed probes must still be deleted.
cli() { timeout --foreground 60 env -i HOME="$root/home" PATH="$PATH" openshell "$@"; }
case "${1:-}" in
start)
  test -r /dev/kvm && test -w /dev/kvm
  if systemctl --user is-active --quiet pi-workbench-t0-vm; then
    echo 'Refusing to overwrite configuration of a running probe.' >&2; exit 1
  fi
  listeners="$(ss -H -ltn '( sport = :18770 )')"
  if test -n "$listeners"; then
    echo 'Port 18770 is occupied; do not replace another gateway.' >&2; exit 1
  fi
  mkdir -p "$root/state" "$root/home/.config/openshell/gateways/workbench-t0/mtls"
  if ! test -f "$root/tls/ca.crt"; then
    env -i HOME="$root/home" PATH="$PATH" openshell-gateway generate-certs --output-dir "$root/tls" --server-san host.openshell.internal
  fi
  cp "$root/tls/ca.crt" "$root/home/.config/openshell/gateways/workbench-t0/mtls/ca.crt"
  cp "$root/tls/client/tls.crt" "$root/home/.config/openshell/gateways/workbench-t0/mtls/tls.crt"
  cp "$root/tls/client/tls.key" "$root/home/.config/openshell/gateways/workbench-t0/mtls/tls.key"
  cat > "$root/gateway.toml" <<EOF
[openshell]
version = 1
[openshell.gateway]
compute_drivers = ["vm"]
[openshell.gateway.gateway_jwt]
signing_key_path = "$root/tls/jwt/signing.pem"
public_key_path = "$root/tls/jwt/public.pem"
kid_path = "$root/tls/jwt/kid"
gateway_id = "workbench-t0"
ttl_secs = 900
[openshell.gateway.auth]
allow_unauthenticated_users = false
[openshell.drivers.vm]
driver_dir = "$root/bin"
state_dir = "$root/state"
grpc_endpoint = "https://host.openshell.internal:18770"
default_image = "ghcr.io/nvidia/openshell-community/sandboxes/base@sha256:c2a43bb0d765774e2790b3babfb20997bb2eac7b4bf4c6d7d8661e99817bf904"
bootstrap_image = "ghcr.io/nvidia/openshell-community/sandboxes/base@sha256:c2a43bb0d765774e2790b3babfb20997bb2eac7b4bf4c6d7d8661e99817bf904"
vcpus = 2
mem_mib = 2048
overlay_disk_mib = 4096
guest_tls_ca = "$root/tls/ca.crt"
guest_tls_cert = "$root/tls/client/tls.crt"
guest_tls_key = "$root/tls/client/tls.key"
EOF
  systemd-run --user --unit=pi-workbench-t0-vm --collect \
    --property=MemoryMax=6G --property=CPUQuota=200% --property=TasksMax=512 \
    --property=RuntimeMaxSec=1800 --property=TimeoutStopSec=30 \
    env -i HOME="$root/home" PATH="$PATH" \
    openshell-gateway --name workbench-t0 --config "$root/gateway.toml" \
    --drivers vm --bind-address 127.0.0.1 --port 18770 \
    --enable-mtls-auth true --enable-loopback-service-http false \
    --tls-cert "$root/tls/server/tls.crt" --tls-key "$root/tls/server/tls.key" \
    --tls-client-ca "$root/tls/ca.crt" --db-url "sqlite:$root/gateway.db?mode=rwc"
  ;;
register) cli gateway add --local --name workbench-t0 https://127.0.0.1:18770 ;;
status) cli -g workbench-t0 status ;;
create)
  echo 'TRUSTED DIAGNOSTICS ONLY: missing Landlock/PID protection blocks worker admission.' >&2
  cli -g workbench-t0 sandbox create --name workbench-t0-probe \
    --policy "$PWD/config/native-diagnostic-policy.yaml" \
    --no-auto-providers --detach --no-tty -- sh -c 'sleep 1200'
  ;;
checkpoint-stop)
  # Caller must first quiesce its trusted work. This is NOT atomic shutdown,
  # does not stop concurrent writers and cannot protect against forced exit.
  cli -g workbench-t0 sandbox exec --name workbench-t0-probe --no-tty --timeout 20 -- sync
  cli -g workbench-t0 sandbox stop workbench-t0-probe
  ;;
logs) journalctl --user -u pi-workbench-t0-vm -n 60 --no-pager ;;
stop) systemctl --user stop pi-workbench-t0-vm ;;
cli) shift; cli -g workbench-t0 "$@" ;;
*) echo 'usage: native-probe.sh start|register|status|create|checkpoint-stop|logs|stop|cli ...' >&2; exit 2 ;;
esac
