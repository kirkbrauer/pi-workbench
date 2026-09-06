#!/usr/bin/env bash
# Synthetic diagnostics only. Raw stop must not inherit the checkpoint workaround.
set -euo pipefail
cd "$(dirname "$0")/.."
mode="${1:?usage: native-lifecycle-probe.sh plain|checkpoint}"
case "$mode" in plain|checkpoint) ;; *) exit 2;; esac
probe() { bash scripts/native-probe.sh cli "$@"; }
before="$(probe sandbox exec --name workbench-t0-probe --no-tty --timeout 20 -- python3 - "$mode" <<'PY'
import sys
from pathlib import Path
boot = Path('/proc/sys/kernel/random/boot_id').read_text().strip()
path = Path('/sandbox/t0-' + sys.argv[1])
path.write_text(boot + '\n')
assert path.read_text().strip() == boot
print(boot)
PY
)"
[[ "$before" =~ ^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$ ]]
printf 'write/read PASS %s %s\n' "$mode" "$before"
if test "$mode" = checkpoint; then
  bash scripts/native-probe.sh checkpoint-stop
else
  probe sandbox stop workbench-t0-probe
fi
probe sandbox start workbench-t0-probe
probe sandbox exec --name workbench-t0-probe --no-tty --timeout 20 -- python3 - "$mode" "$before" <<'PY'
import sys
from pathlib import Path
mode, before = sys.argv[1:]
boot = Path('/proc/sys/kernel/random/boot_id').read_text().strip()
path = Path('/sandbox/t0-' + mode)
print('after restart', mode, boot, flush=True)
assert boot != before, 'FAIL: guest did not reboot'
assert path.exists(), f'FAIL: {path} disappeared'
assert path.read_text().strip() == before, 'FAIL: marker stale or corrupt'
print('persistence PASS', mode, before, '->', boot)
PY
