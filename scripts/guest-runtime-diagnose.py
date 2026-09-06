#!/usr/bin/env python3
"""Read-only Tier 0 guest diagnostics; not a worker acceptance test."""
import ctypes
import gzip
import json
import os
import platform
from pathlib import Path


def read(path):
    try:
        return Path(path).read_text().strip()
    except OSError as error:
        return f"unavailable: {error.strerror} (errno={error.errno})"


report = {
    "kernel": platform.release(),
    "architecture": platform.machine(),
    "uid": os.getuid(),
    "boot_id": read("/proc/sys/kernel/random/boot_id"),
    "lsm": read("/sys/kernel/security/lsm"),
    "security_boot_options": [
        word for word in read("/proc/cmdline").split()
        if word.startswith(("lsm=", "security=", "landlock."))
    ],
    "cgroup": read("/proc/self/cgroup"),
    "controllers": read("/sys/fs/cgroup/cgroup.controllers"),
    "subtree_control": read("/sys/fs/cgroup/cgroup.subtree_control"),
    "root_pids_max": read("/sys/fs/cgroup/pids.max"),
    "process_security": [
        line for line in read("/proc/self/status").splitlines()
        if line.startswith(("Cap", "NoNewPrivs:", "Seccomp"))
    ],
    "mounts": [
        line for line in read("/proc/self/mountinfo").splitlines()
        if " - cgroup" in line or " - overlay " in line or " - ext4 " in line
    ],
}
# Linux x86_64/aarch64 both assign 444 to landlock_create_ruleset.
# Query only: NULL ruleset, size=0, LANDLOCK_CREATE_RULESET_VERSION=1.
if platform.machine() in ("x86_64", "aarch64"):
    libc = ctypes.CDLL(None, use_errno=True)
    libc.syscall.restype = ctypes.c_long
    abi = libc.syscall(ctypes.c_long(444), ctypes.c_void_p(), ctypes.c_size_t(0), ctypes.c_uint(1))
    report["landlock"] = {"abi": abi, "errno": ctypes.get_errno() if abi < 0 else 0}
else:
    report["landlock"] = {"error": "unsupported probe architecture"}
try:
    with gzip.open("/proc/config.gz", "rt") as config:
        report["kernel_config"] = [
            line.strip() for line in config
            if any(key in line for key in ("LANDLOCK", "CONFIG_LSM", "CGROUP_PIDS", "SECURITYFS"))
        ]
except OSError as error:
    report["kernel_config"] = f"unavailable: {error}"
print(json.dumps(report, indent=2))
