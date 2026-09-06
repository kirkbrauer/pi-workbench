"""Host-only tests: no OpenShell, VM, installs, signing or networking."""
import importlib.util
import json
from pathlib import Path
import socket
import ssl
import subprocess
import threading
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

    def test_profiles_are_explicit_and_stable_is_default(self):
        stable = probe.Probe(Path('/unused'))
        rolling = probe.Probe(Path('/unused'), 'rolling')
        self.assertEqual(stable.profile, 'stable')
        self.assertEqual(stable.pins_path.name, 'macos-native-artifacts.json')
        self.assertEqual(rolling.pins_path.name, 'macos-rolling-artifacts.json')
        with self.assertRaises(ValueError):
            probe.Probe(Path('/unused'), 'latest')

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

    def test_capture_actual_console_filename_not_private_state(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            evidence = root / "evidence"
            evidence.mkdir()
            instance = probe.Probe(evidence)
            instance.root = root / "runtime"
            sandbox = instance.root / "state/sandboxes/synthetic"
            sandbox.mkdir(parents=True)
            (sandbox / "rootfs-console.log").write_text("synthetic boot diagnostic")
            (sandbox / "sandbox.pb").write_text("must not capture")
            (sandbox / "overlay.ext4").write_text("must not capture")
            instance.capture_logs("test")
            self.assertEqual((evidence / "test-state_sandboxes_synthetic_rootfs-console.log").read_text(), "synthetic boot diagnostic")
            self.assertFalse(any(p.suffix in (".pb", ".ext4", ".key") for p in evidence.iterdir()))

    @unittest.skipUnless(sys.platform == "darwin", "Mac system OpenSSL fixture")
    def test_synthetic_pki_passes_strict_mutual_tls(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "tls/server").mkdir(parents=True)
            (root / "tls/client").mkdir()
            def command(_label, args):
                subprocess.run(args, check=True, capture_output=True, timeout=10)
            probe.issue_synthetic_mtls(root, command)
            server = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
            server.load_cert_chain(root / "tls/server/tls.crt", root / "tls/server/tls.key")
            server.load_verify_locations(root / "tls/ca.crt")
            server.verify_mode = ssl.CERT_REQUIRED
            server.verify_flags |= ssl.VERIFY_X509_STRICT
            client = ssl.create_default_context(cafile=str(root / "tls/ca.crt"))
            client.verify_flags |= ssl.VERIFY_X509_STRICT
            client.load_cert_chain(root / "tls/client/tls.crt", root / "tls/client/tls.key")
            result = []
            with socket.socket() as listener:
                listener.bind(("127.0.0.1", 0))
                listener.listen()
                listener.settimeout(5)
                def serve():
                    try:
                        raw, _ = listener.accept()
                        with raw:
                            raw.settimeout(5)
                            with server.wrap_socket(raw, server_side=True) as conn:
                                result.append(bool(conn.getpeercert()))
                                conn.sendall(b"synthetic")
                    except Exception as error:
                        result.append(error)
                thread = threading.Thread(target=serve)
                thread.start()
                try:
                    with socket.create_connection(listener.getsockname(), timeout=5) as raw:
                        with client.wrap_socket(raw, server_hostname="127.0.0.1") as conn:
                            self.assertEqual(conn.recv(16), b"synthetic")
                finally:
                    thread.join(timeout=6)
                self.assertEqual(result, [True])

    def test_invalid_arguments_cannot_launch(self):
        result = subprocess.run([sys.executable, "-B", str(MODULE)], capture_output=True, timeout=5)
        self.assertEqual(result.returncode, 2)


if __name__ == "__main__":
    unittest.main()
