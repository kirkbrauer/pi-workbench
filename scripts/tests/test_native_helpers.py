"""Host-only orchestration tests with a fake CLI; never start a VM/service."""
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

SOURCE = Path(__file__).resolve().parents[1]


class CheckpointTests(unittest.TestCase):
    def run_checkpoint(self, fail_sync):
        with tempfile.TemporaryDirectory(prefix="workbench-helper-test-") as tmp:
            root = Path(tmp)
            (root / "scripts").mkdir()
            shutil.copyfile(SOURCE / "native-probe.sh", root / "scripts/native-probe.sh")
            binary = root / ".local/openshell/bin/openshell"
            binary.parent.mkdir(parents=True)
            binary.write_text(
                '#!/bin/sh\nset -eu\n'
                'test -z "${FAKE_HOST_SECRET:-}"\n'
                'printf "%s\\n" "$*" >> "$(dirname "$0")/calls"\n'
                + ('case "$*" in *"sandbox exec"*) exit 23;; esac\n' if fail_sync else '')
            )
            binary.chmod(0o755)
            result = subprocess.run(
                ["bash", str(root / "scripts/native-probe.sh"), "checkpoint-stop"],
                env={**os.environ, "FAKE_HOST_SECRET": "synthetic-only"},
                capture_output=True, text=True, timeout=5,
            )
            calls = (binary.parent / "calls").read_text().splitlines()
            return result, calls

    def test_sync_failure_prevents_stop(self):
        result, calls = self.run_checkpoint(True)
        self.assertEqual(result.returncode, 23, result.stderr)
        self.assertEqual(len(calls), 1)
        self.assertIn("--timeout 20 -- sync", calls[0])
        self.assertNotIn("sandbox stop", calls[0])

    def test_success_syncs_before_stop_with_clean_environment(self):
        result, calls = self.run_checkpoint(False)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(len(calls), 2)
        self.assertIn("sandbox exec --name workbench-t0-probe", calls[0])
        self.assertIn("--timeout 20 -- sync", calls[0])
        self.assertEqual(calls[1], "-g workbench-t0 sandbox stop workbench-t0-probe")

    def test_invalid_lifecycle_mode_rejected_before_cli(self):
        result = subprocess.run(
            ["bash", str(SOURCE / "native-lifecycle-probe.sh"), "invalid"],
            capture_output=True, timeout=5,
        )
        self.assertEqual(result.returncode, 2)


if __name__ == "__main__":
    unittest.main()
