#!/usr/bin/env python3
"""Foreground, synthetic-only Mac diagnostic. Not a broker or acceptance gate.

Requires separately inspected/attested artifacts and approved upstream ad-hoc
Hypervisor signing. Never installs/signs, mounts host data, or starts an engine.
Private raw logs need review before publication. All runtime state is disposable.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import platform
import re
import shutil
import signal
import socket
import ssl
import subprocess
import tempfile
import time

REPO = Path(__file__).resolve().parent.parent
GATEWAY = "wb-mac"
NAMES = ("wb-mac-diagnostic", "wb-mac-strict")
PORT = 18770


def sha(path):
    with Path(path).open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def clean_env(root):
    # No inherited provider, Git, keychain/SSH-agent, engine or approval state.
    return {
        "HOME": str(root / "home"),
        "TMPDIR": str(root / "tmp"),
        "XDG_RUNTIME_DIR": str(root / "run"),
        "PATH": f"{root}/bin:/opt/homebrew/opt/e2fsprogs/sbin:/usr/bin:/bin",
        "DOCKER_HOST": f"unix://{root}/no-engine.sock",
    }


def group_members(pgid):
    table = subprocess.check_output(["/bin/ps", "-axo", "pid=,pgid=,uid=,stat=,comm="], text=True, timeout=5)
    return [line for line in table.splitlines()
            if len(line.split()) >= 4 and line.split()[1] == str(pgid)]


def stop_group(child):
    # Only groups created by this helper's Popen(start_new_session=True).
    # Darwin returns EPERM when a group contains only unreaped zombies. Do not
    # suppress a genuine live-process refusal or request extra permissions.
    for sig in (signal.SIGTERM, signal.SIGKILL):
        members = group_members(child.pid)
        live = [line for line in members if not line.split()[3].startswith("Z")]
        if not live:
            break
        if any(line.split()[2] != str(os.getuid()) for line in live):
            raise RuntimeError("unexpected UID in owned process group")
        try:
            os.killpg(child.pid, sig)
        except ProcessLookupError:
            pass
        except PermissionError:
            if any(not line.split()[3].startswith("Z") for line in group_members(child.pid)):
                raise
        time.sleep(0.25)
    child.wait(timeout=10)


def run(args, env, cwd, timeout=60, input_text=None):
    # Files rather than pipes: a grandchild retaining stdout cannot block drain.
    with tempfile.TemporaryFile() as out, tempfile.TemporaryFile() as err:
        child = subprocess.Popen(args, env=env, cwd=cwd, start_new_session=True,
                                 stdin=subprocess.PIPE if input_text is not None else subprocess.DEVNULL,
                                 stdout=out, stderr=err, text=True)
        try:
            child.communicate(input=input_text, timeout=timeout)
            code = child.returncode
        except subprocess.TimeoutExpired:
            stop_group(child)
            code = 124
        except BaseException:
            stop_group(child)
            raise
        out.seek(0)
        err.seek(0)
        # Explicit bounded evidence, never an unbounded transcript dump.
        stdout, stderr = out.read(128 * 1024), err.read(128 * 1024)
        return code, stdout.decode(errors="replace"), stderr.decode(errors="replace")


def checkpoint_stop(exec_sync, stop):
    result = exec_sync()
    if result[0] != 0:
        raise RuntimeError("guest sync failed; refusing checkpoint stop")
    return stop()


def issue_synthetic_mtls(root, command):
    """Short-lived diagnostic PKI; keep strict TLS checks and separate JWT keys.

    Upstream 0.0.116 certgen's leaf certificates omit AKI. Use standard external
    certificate provisioning, not modified OpenShell or relaxed TLS verification.
    """
    tls = root / "tls"
    config = tls / "synthetic.cnf"
    config.write_text('''[req]
distinguished_name = dn
[dn]
[ca]
basicConstraints = critical,CA:TRUE
keyUsage = critical,keyCertSign,cRLSign
subjectKeyIdentifier = hash
authorityKeyIdentifier = keyid:always
[server]
basicConstraints = critical,CA:FALSE
keyUsage = critical,digitalSignature
extendedKeyUsage = serverAuth
subjectKeyIdentifier = hash
authorityKeyIdentifier = keyid:always
subjectAltName = DNS:localhost,DNS:host.openshell.internal,IP:127.0.0.1
[client]
basicConstraints = critical,CA:FALSE
keyUsage = critical,digitalSignature
extendedKeyUsage = clientAuth
subjectKeyIdentifier = hash
authorityKeyIdentifier = keyid:always
''')
    def openssl(label, args):
        return command(label, ["/usr/bin/openssl", *map(str, args)])
    openssl("synthetic-ca-key", ["ecparam", "-name", "prime256v1", "-genkey", "-noout", "-out", tls / "ca.key"])
    openssl("synthetic-ca", ["req", "-new", "-x509", "-key", tls / "ca.key", "-sha256", "-days", "2",
                            "-subj", "/CN=workbench-synthetic-ca", "-config", config, "-extensions", "ca", "-out", tls / "ca.crt"])
    for role, subject in (("server", "/CN=openshell-server"), ("client", "/CN=openshell-client/OU=openshell-user")):
        directory = tls / role
        openssl(f"synthetic-{role}-key", ["ecparam", "-name", "prime256v1", "-genkey", "-noout", "-out", directory / "tls.key"])
        openssl(f"synthetic-{role}-csr", ["req", "-new", "-key", directory / "tls.key", "-subj", subject, "-out", directory / "tls.csr"])
        openssl(f"synthetic-{role}-cert", ["x509", "-req", "-in", directory / "tls.csr", "-CA", tls / "ca.crt",
                                        "-CAkey", tls / "ca.key", "-CAcreateserial", "-days", "2", "-sha256",
                                        "-extfile", config, "-extensions", role, "-out", directory / "tls.crt"])


def configuration(root, image):
    return f'''[openshell]
version = 1
[openshell.gateway]
compute_drivers = ["vm"]
[openshell.gateway.gateway_jwt]
signing_key_path = "{root}/tls/jwt/signing.pem"
public_key_path = "{root}/tls/jwt/public.pem"
kid_path = "{root}/tls/jwt/kid"
gateway_id = "{GATEWAY}"
ttl_secs = 900
[openshell.gateway.auth]
allow_unauthenticated_users = false
[openshell.drivers.vm]
driver_dir = "{root}/bin"
state_dir = "{root}/state"
grpc_endpoint = "https://host.openshell.internal:{PORT}"
default_image = "{image}"
bootstrap_image = "{image}"
vcpus = 2
mem_mib = 2048
overlay_disk_mib = 4096
guest_tls_ca = "{root}/tls/ca.crt"
guest_tls_cert = "{root}/tls/client/tls.crt"
guest_tls_key = "{root}/tls/client/tls.key"
'''


class Probe:
    def __init__(self, evidence):
        self.evidence = evidence.resolve()
        self.root = None
        self.gateway = None
        self.log = None
        self.created = []
        self.sequence = 0
        self.results = {}

    def command(self, label, args, timeout=60, input_text=None, required=True):
        self.sequence += 1
        result = run(args, self.env, self.root, timeout, input_text)
        code, stdout, stderr = result
        (self.evidence / f"{self.sequence:02}-{label}.txt").write_text(
            f"exit={code}\nstdout (first 128KiB):\n{stdout}\nstderr (first 128KiB):\n{stderr}")
        print(f"{label}: exit={code}", flush=True)
        if required and code:
            raise RuntimeError(f"{label}: exit {code}; see private evidence")
        return result

    def cli(self, label, args, **kwargs):
        return self.command(label, [str(self.root / "bin/openshell"), "-g", GATEWAY, *args], **kwargs)

    def execute(self, label, code, name=NAMES[0], required=True):
        return self.cli(label, ["sandbox", "exec", "--name", name, "--no-tty", "--timeout", "20",
                                "--", "python3", "-"], input_text=code, required=required)

    def setup(self):
        if platform.system() != "Darwin" or platform.machine() != "arm64":
            raise RuntimeError("requires native Apple Silicon macOS")
        if subprocess.check_output(["/usr/sbin/sysctl", "-n", "kern.hv_support"], text=True).strip() != "1":
            raise RuntimeError("Hypervisor unavailable")
        if shutil.disk_usage("/private/tmp").free < 20 * 1024**3:
            raise RuntimeError("less than 20 GiB free")
        with socket.socket() as sock:
            sock.bind(("127.0.0.1", PORT))
        # Upstream checks these even with explicit VM. Do not contact an engine.
        for path in ("/run/podman/podman.sock", "/var/run/podman/podman.sock"):
            if Path(path).exists():
                raise RuntimeError(f"unexpected engine socket: {path}")
        for name in ("mke2fs", "debugfs"):
            if not os.access(f"/opt/homebrew/opt/e2fsprogs/sbin/{name}", os.X_OK):
                raise RuntimeError(f"missing reviewed e2fsprogs {name}")
        pins = json.loads((REPO / "config/macos-native-artifacts.json").read_text())
        if pins["platform"] != "linux/arm64" or not re.fullmatch(
                r"ghcr.io/nvidia/openshell-community/sandboxes/base@sha256:[0-9a-f]{64}", pins["image"]):
            raise RuntimeError("image must be platform-inspected and digest-pinned")
        self.root = Path(tempfile.mkdtemp(prefix="wbm-", dir="/private/tmp"))
        if self.root.stat().st_uid != os.getuid() or self.root.stat().st_mode & 0o077:
            raise RuntimeError("state is not private/user-owned")
        if len(os.fsencode(self.root / "state/run/compute-driver.sock")) >= 100:
            raise RuntimeError("Unix socket path too long")
        for name in ("bin", "home", "tmp", "run", "state"):
            (self.root / name).mkdir(mode=0o700)
        self.env = clean_env(self.root)
        source = REPO / ".local/macos-preflight"
        for name, digest in pins["binaries"].items():
            original = source / ("signed" if name.endswith("-vm") else "unpacked") / name
            if sha(original) != digest:
                raise RuntimeError(f"artifact drift: {name}")
            shutil.copy2(original, self.root / "bin" / name)
            if sha(self.root / "bin" / name) != digest:
                raise RuntimeError(f"staged artifact drift: {name}")
        self.command("signature", ["/usr/bin/codesign", "--verify", "--strict", str(self.root / "bin/openshell-driver-vm")])
        _, entitlement, _ = self.command("entitlements", ["/usr/bin/codesign", "-d", "--entitlements", "-", str(self.root / "bin/openshell-driver-vm")])
        if "com.apple.security.hypervisor" not in entitlement or "true" not in entitlement:
            raise RuntimeError("Hypervisor entitlement not observed")
        self.command("certs", [str(self.root / "bin/openshell-gateway"), "generate-certs", "--output-dir", str(self.root / "tls"), "--server-san", "host.openshell.internal"])
        issue_synthetic_mtls(self.root, self.command)
        mtls = self.root / f"home/.config/openshell/gateways/{GATEWAY}/mtls"
        mtls.mkdir(parents=True, mode=0o700)
        for src, dst in (("ca.crt", "ca.crt"), ("client/tls.crt", "tls.crt"), ("client/tls.key", "tls.key")):
            shutil.copy2(self.root / "tls" / src, mtls / dst)
        (self.root / "gateway.toml").write_text(configuration(self.root, pins["image"]))
        (self.root / "host-denied-fixture").write_text("synthetic-host-only\n")
        policy = (REPO / "config/native-diagnostic-policy.yaml").read_text()
        (self.root / "diagnostic.yaml").write_text(policy)
        if policy.count("compatibility: best_effort") != 1:
            raise RuntimeError("unexpected diagnostic policy")
        (self.root / "strict.yaml").write_text(policy.replace("compatibility: best_effort", "compatibility: hard_requirement"))
        for name in ("gateway.toml", "diagnostic.yaml", "strict.yaml"):
            shutil.copy2(self.root / name, self.evidence / name)
        self.results["binding"] = {
            "checkout": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=REPO, text=True).strip(),
            "host": subprocess.check_output(["/usr/bin/sw_vers"], text=True),
            "architecture": platform.machine(), "state": str(self.root), "pins": pins,
            "hashes": {str(p.relative_to(REPO)): sha(p) for p in (
                REPO / "scripts/macos-native-probe.py", REPO / "scripts/guest-runtime-diagnose.py",
                REPO / "config/macos-native-artifacts.json", REPO / "config/native-diagnostic-policy.yaml")},
            "config_sha256": sha(self.root / "gateway.toml"),
            "synthetic_pki_hashes": {name: sha(self.root / "tls" / name) for name in
                                     ("synthetic.cnf", "ca.crt", "server/tls.crt", "client/tls.crt")},
            "host_controls": "operation/overall wall deadlines and owned process groups only; no aggregate RAM/CPU/PID enforcement",
        }

    def start(self):
        root = self.root
        self.log = (root / "gateway.log").open("w")
        self.gateway = subprocess.Popen([
            str(root / "bin/openshell-gateway"), "--name", GATEWAY, "--config", str(root / "gateway.toml"),
            "--drivers", "vm", "--bind-address", "127.0.0.1", "--port", str(PORT),
            "--health-port", "0", "--metrics-port", "0", "--enable-mtls-auth", "true",
            "--enable-loopback-service-http", "false", "--tls-cert", str(root / "tls/server/tls.crt"),
            "--tls-key", str(root / "tls/server/tls.key"), "--tls-client-ca", str(root / "tls/ca.crt"),
            "--db-url", f"sqlite:{root}/gateway.db?mode=rwc"],
            cwd=root, env=self.env, stdin=subprocess.DEVNULL, stdout=self.log, stderr=self.log, start_new_session=True)
        context = ssl.create_default_context(cafile=str(root / "tls/ca.crt"))
        context.load_cert_chain(str(root / "tls/client/tls.crt"), str(root / "tls/client/tls.key"))
        for _ in range(30):
            if self.gateway.poll() is not None:
                raise RuntimeError("gateway exited before readiness")
            try:
                with socket.create_connection(("127.0.0.1", PORT), timeout=2) as raw:
                    with context.wrap_socket(raw, server_hostname="127.0.0.1"):
                        break
            except ssl.SSLCertVerificationError as error:
                raise RuntimeError(f"TLS verification failed: {error.verify_code} {error.verify_message}") from error
            except (OSError, ssl.SSLError):
                time.sleep(1)
        else:
            raise RuntimeError("authenticated TLS readiness deadline")
        _, listeners, _ = self.command("listeners", ["/usr/sbin/lsof", "-nP", "-a", "-p", str(self.gateway.pid), "-iTCP", "-sTCP:LISTEN"])
        addresses = re.findall(r"TCP (\S+) \(LISTEN\)", listeners)
        if addresses != [f"127.0.0.1:{PORT}"]:
            raise RuntimeError(f"unexpected gateway listeners: {addresses}")
        self.cli("register", ["gateway", "add", "--local", "--name", GATEWAY, f"https://127.0.0.1:{PORT}"])
        self.cli("status", ["status"])
        # A trusted server certificate without client identity must not grant status.
        self.command("no-client-cert", ["/usr/bin/curl", "-q", "--max-time", "5", "--cacert", str(root / "tls/ca.crt"), f"https://127.0.0.1:{PORT}/healthz"], required=False)

    def create(self, name, policy, timeout):
        self.created.append(name)  # Even CLI failure/timeout can leave a sandbox.
        return self.cli(f"create-{policy}", ["sandbox", "create", "--name", name, "--policy", str(self.root / f"{policy}.yaml"),
                        "--no-auto-providers", "--detach", "--no-tty", "--", "sh", "-c",
                        "echo MAC_STRICT_CANONICAL_STARTED; sleep 1200" if policy == "strict" else "sleep 1200"],
                        timeout=timeout, required=False)

    def lifecycle(self, mode):
        _, before, _ = self.execute(f"{mode}-write", f'''from pathlib import Path
boot = Path('/proc/sys/kernel/random/boot_id').read_text().strip()
p = Path('/sandbox/mac-{mode}')
p.write_text(boot + '\\n')
assert p.read_text() == boot + '\\n'
print(boot)
''')
        before = before.strip()
        if not re.fullmatch(r"[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}", before):
            raise RuntimeError("invalid boot marker")
        stop = lambda: self.cli(f"{mode}-stop", ["sandbox", "stop", NAMES[0]])
        if mode == "checkpoint":
            checkpoint_stop(lambda: self.cli("sync", ["sandbox", "exec", "--name", NAMES[0], "--no-tty", "--timeout", "20", "--", "sync"]), stop)
        else:
            stop()
        self.cli(f"{mode}-start", ["sandbox", "start", NAMES[0]])
        result = self.execute(f"{mode}-read", f'''from pathlib import Path
boot = Path('/proc/sys/kernel/random/boot_id').read_text().strip()
p = Path('/sandbox/mac-{mode}')
print('new_boot', boot, 'old_boot', {before!r}, flush=True)
assert boot != {before!r}, 'boot did not change'
assert p.exists(), 'marker disappeared'
assert p.read_text() == {before!r} + '\\n', 'marker differs'
print('exact marker and changed boot PASS')
''', required=False)
        self.results[mode] = result[0]

    def diagnostics(self):
        result = self.create(NAMES[0], "diagnostic", 300)
        self.results["create_diagnostic"] = result[0]
        self.cli("diagnostic-phase", ["sandbox", "get", NAMES[0]], required=False)
        if result[0] == 0:
            self.execute("runtime", (REPO / "scripts/guest-runtime-diagnose.py").read_text())
            denied = [str(self.root / "host-denied-fixture"), str(Path.home()),
                      "/var/run/docker.sock", "/run/podman/podman.sock"]
            self.execute("boundary", f'''import json, os
from pathlib import Path
paths = {denied!r}
report = {{'absent_paths': {{p: not Path(p).exists() for p in paths}},
          'vcpus': os.cpu_count(), 'meminfo': Path('/proc/meminfo').read_text().splitlines()[:3],
          'socket_env_absent': {{k: k not in os.environ for k in ['SSH_AUTH_SOCK','DOCKER_HOST','CONTAINER_HOST']}}}}
p = Path('/sandbox/mac-allowed')
p.write_text('synthetic-workspace\\n')
report['workspace_write_read'] = p.read_text() == 'synthetic-workspace\\n'
print(json.dumps(report, indent=2))
assert all(report['absent_paths'].values())
assert all(report['socket_env_absent'].values())
assert report['workspace_write_read']
''', required=False)
            # Host positive transport control: outage must not become policy evidence.
            self.command("host-network-control", ["/usr/bin/curl", "-q", "-I", "--max-time", "10", "https://example.com/"], required=False)
            self.execute("network", '''import json, socket, urllib.request, urllib.error
report = {}
try:
    with urllib.request.urlopen('https://example.com/', timeout=5) as r:
        report['proxy_status'] = r.status
except urllib.error.HTTPError as e:
    report['proxy_status'] = e.code
except Exception as e:
    report['proxy_unknown'] = str(e)
try:
    with socket.create_connection(('1.1.1.1', 443), timeout=5):
        report['direct_tcp'] = 'CONNECTED: bypass concern'
except OSError as e:
    report['direct_tcp'] = {'errno': e.errno, 'error': str(e)}
print(json.dumps(report, indent=2))
''', required=False)
            for mode in ("plain", "checkpoint"):
                try:
                    self.lifecycle(mode)
                except Exception as error:
                    self.results[mode] = f"error: {error}"
            self.capture_logs("diagnostic")
            self.cli("delete-diagnostic", ["sandbox", "delete", NAMES[0]], required=False)
        # Separate strict policy, unchanged even if diagnostic startup failed.
        self.results["create_strict"] = self.create(NAMES[1], "strict", 60)[0]
        self.cli("strict-phase", ["sandbox", "get", NAMES[1]], required=False)
        self.capture_logs("strict")

    def capture_logs(self, label):
        if not self.root:
            return
        for pattern in ("gateway.log", "state/**/console.log", "state/**/gvproxy.log", "state/**/provenance.json"):
            for path in self.root.glob(pattern):
                if path.is_file() and not path.is_symlink():
                    with path.open("rb") as stream:
                        size = path.stat().st_size
                        stream.seek(max(0, size - 128 * 1024))
                        data = stream.read(128 * 1024)
                    name = str(path.relative_to(self.root)).replace("/", "_")
                    (self.evidence / f"{label}-{name}").write_bytes(data)
        self.results["extracted_runtime_hashes"] = {
            str(p.relative_to(self.root)): sha(p) for p in self.root.rglob("*")
            if p.is_file() and not p.is_symlink() and (
                p.suffix == ".dylib" or p.name in ("gvproxy", "umoci", "provenance.json"))
        }
        overlays = [{"path": str(p.relative_to(self.root)), "bytes": p.stat().st_size}
                    for p in self.root.glob("state/**/overlay.ext4")]
        (self.evidence / f"{label}-overlays.json").write_text(json.dumps(overlays, indent=2))

    def cleanup(self):
        if not self.root:
            return
        if self.gateway is not None:
            try:
                for name in self.created:
                    self.cli(f"cleanup-{name}", ["sandbox", "delete", name], timeout=30, required=False)
                self.cli("cleanup-list", ["sandbox", "list"], timeout=15, required=False)
            finally:
                self.capture_logs("final")
                # Allow normal upstream child shutdown, then clean only owned group.
                if self.gateway.poll() is None:
                    self.gateway.terminate()
                    time.sleep(6)
                stop_group(self.gateway)
                time.sleep(2)
                if self.log:
                    self.log.close()
        # A nonempty owned process group blocks deletion, leaving state for recovery.
        if self.gateway:
            remaining = group_members(self.gateway.pid)
            self.results["remaining_group"] = remaining
            if remaining:
                raise RuntimeError(f"owned children remain; preserve {self.root} for cleanup")
        self.results["overlay_paths_before_state_removal"] = [str(p.relative_to(self.root)) for p in self.root.glob("state/**/overlay.ext4")]
        shutil.rmtree(self.root)
        self.results["state_removed"] = not self.root.exists()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--evidence", required=True, type=Path, help="new private output directory; never publish raw logs blindly")
    args = parser.parse_args()
    os.umask(0o077)
    args.evidence.mkdir(mode=0o700, parents=True, exist_ok=False)
    probe = Probe(args.evidence)

    def interrupted(signum, _frame):
        raise RuntimeError(f"probe interrupted/deadline: signal {signum}")

    for sig in (signal.SIGTERM, signal.SIGINT, signal.SIGALRM):
        signal.signal(sig, interrupted)
    signal.alarm(1200)
    code = 0
    try:
        probe.setup()
        probe.start()
        probe.diagnostics()
    except Exception as error:
        probe.results["error"] = str(error)
        print(f"probe error: {error}", flush=True)
        code = 1
    finally:
        signal.alarm(0)
        try:
            probe.cleanup()
        except Exception as error:
            probe.results["cleanup_error"] = str(error)
            print(f"cleanup error: {error}", flush=True)
            code = 1
        (probe.evidence / "results.json").write_text(json.dumps(probe.results, indent=2) + "\n")
    print("Diagnostic finished; exit 0 is NOT worker qualification. Review every result.", flush=True)
    return code


if __name__ == "__main__":
    raise SystemExit(main())
