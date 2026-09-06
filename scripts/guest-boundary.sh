#!/bin/sh
set -eu
printf 'kernel='; uname -r
printf 'boot_id='; cat /proc/sys/kernel/random/boot_id
id
printf 'vcpus='; getconf _NPROCESSORS_ONLN
head -1 /proc/meminfo
cat /proc/self/cgroup
# No real credentials are read. This pathname holds a synthetic fixture on the host.
if test -e /home/kirk/repos/pi-workbench/.local/host-denied-fixture; then
  echo 'FAIL: host fixture visible'; exit 1
fi
for p in /home/kirk /var/run/docker.sock /run/user/1000/podman/podman.sock; do
  test ! -e "$p" || { echo "FAIL: unexpected host path $p"; exit 1; }
done
printf 'synthetic-workspace-marker\n' > /sandbox/t0-marker
test "$(cat /sandbox/t0-marker)" = synthetic-workspace-marker
echo 'allowed workspace write/read passed; host fixture/home/engine paths absent'
# Required runtime protection: do NOT interpret missing PID controls as a pass.
if ! test -f /sys/fs/cgroup/pids.max || test "$(cat /sys/fs/cgroup/pids.max)" = max; then
  echo 'FAIL: guest PID budget unavailable/unlimited'; exit 1
fi
