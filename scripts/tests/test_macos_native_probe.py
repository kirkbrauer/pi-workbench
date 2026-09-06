"""Host-only tests: no OpenShell, VM, installs, signing or networking."""
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time
import tomllib
import unittest

MODULE = Path(__file__).resolve().parents[1] / "macos-native-probe.py"
spec = importlib.util.spec_from_file_location("macos_probe", MODULE)
probe = importlib.util.module_from_spec(spec)
spec.loader.exec_module(probe)


class MacProbeTests(unittest.TestCase):
    def test_clean_environment_and_configuration(self):
        root = Path("/private/tmp/wbm-test")
        env = probe.clean_env(root)
        self.assertEqual(set(env), {"HOME", "TMPDIR", "XDG_RUNTIME_DIR", "PATH", "DOCKER_HOST"})
        self.assertNotIn(str(Path.home()), env["HOME"])
        self.assertEqual(env["DOCKER_HOST"], f"unix://{root}/no-engine.sock")
        pins = json.loads((MODULE.parents[1] / "config/macos-native-artifacts.json").read_text())
        config = tomllib.loads(probe.configuration(root, pins["image"]))["openshell"]
        self.assertEqual(config["gateway"]["compute_drivers"], ["vm"])
        self.assertFalse(config["gateway"]["auth"]["allow_unauthenticated_users"])
        self.assertIn("/tls/jwt/", config["gateway"]["gateway_jwt"]["signing_key_path"])
        self.assertEqual(config["drivers"]["vm"]["default_image"], pins["image"])
        self.assertEqual(config["drivers"]["vm"]["bootstrap_image"], pins["image"])
        self.assertEqual(config["drivers"]["vm"]["mem_mib"], 2048)
        self.assertEqual(config["drivers"]["vm"]["overlay_disk_mib"], 4096)

    def test_checkpoint_failure_never_stops(self):
        events = []
        with self.assertRaisesRegex(RuntimeError, "sync failed"):
            probe.checkpoint_stop(lambda: (1, "", ""), lambda: events.append("stop"))
        self.assertEqual(events, [])
        probe.checkpoint_stop(lambda: events.append("sync") or (0, "", ""), lambda: events.append("stop"))
        self.assertEqual(events, ["sync", "stop"])

    def test_bounded_runner_and_stdin(self):
        with tempfile.TemporaryDirectory() as root:
            code, out, _ = probe.run([sys.executable, "-c", "import sys; print(sys.stdin.read())"],
                                     {"PATH": "/usr/bin:/bin"}, root, input_text="synthetic")
            self.assertEqual(code, 0)
            self.assertEqual(out.strip(), "synthetic")
            start = time.monotonic()
            code, _, _ = probe.run([sys.executable, "-c", "import time; time.sleep(30)"],
                                   {"PATH": "/usr/bin:/bin"}, root, timeout=0.2)
            self.assertEqual(code, 124)
            self.assertLess(time.monotonic() - start, 5)

    def test_timeout_kills_owned_descendant(self):
        with tempfile.TemporaryDirectory() as root:
            marker = Path(root) / "escaped"
            child = f"import time; from pathlib import Path; time.sleep(2); Path({str(marker)!r}).touch()"
            parent = "import subprocess,sys,time; subprocess.Popen([sys.executable,'-c',sys.argv[1]]); time.sleep(30)"
            code, _, _ = probe.run([sys.executable, "-c", parent, child],
                                   {"PATH": "/usr/bin:/bin"}, root, timeout=0.3)
            self.assertEqual(code, 124)
            time.sleep(2)
            self.assertFalse(marker.exists())

    def test_invalid_arguments_cannot_launch(self):
        result = subprocess.run([sys.executable, "-B", str(MODULE)], capture_output=True, timeout=5)
        self.assertEqual(result.returncode, 2)


if __name__ == "__main__":
    unittest.main()
