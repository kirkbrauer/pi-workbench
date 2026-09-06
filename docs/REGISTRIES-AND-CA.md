# Registry profiles and scoped CA trust

Public npm is the tested personal/CI default, not a mandatory corporate endpoint.
Mirror support is an **explicit plan interface**, not a qualified JFrog adapter or
credential broker. Operator-owned profiles stay outside Git. A synthetic example
is `config/examples/jfrog-registry.json`; `.invalid` cannot enroll a real service.

After building, `pnpm registry:plan /absolute/operator/profile.json` validates a
profile and certificate-only CA bundle, reports CA fingerprints and prints an argv
array/environment for a trusted installer. It never installs, obtains credentials
or claims that Curation passed. Private plans are explicitly blocked pending real
qualification. Array elements must remain arguments, not interpolated shell text.

The selected registry URL keeps the JFrog virtual-repository path. The plan routes
pnpm and Corepack to that registry with strict TLS, optional process-local CA
trust, frozen lock and no lifecycle scripts. No implicit npmjs fallback. Private
npm scope mappings and upstream proxy configuration must be inspected by the
operator; a curated virtual repository must not offer an uncurated bypass route.
Do not pass a token in a URL or profile, log auth configs, or copy the host's
`.npmrc`, keyring or home into an image/worker. Real token enrollment/delivery is a
trusted human flow, not implemented by this planner.

## Mirror qualification (required before use)

1. Verify profile/account/repository ownership and the exact Curation-enabled
   endpoint; record its non-secret configuration fingerprint privately.
2. Through a separately scoped trusted installer, prove an approved synthetic
   package installs and an intentionally denied fixture is blocked by **Curation**.
   Prove direct npmjs/bypass endpoints are denied by the corporate network policy.
3. Repeat frozen install, release-age/provenance verification and full pnpm audit
   against the mirror. Missing publish-time/provenance/advisory metadata remains
   blocking; do not add exclusions or fall back to public services silently.
4. Verify wrong account, expired/revoked credentials, unavailable mirror and wrong
   CA/hostname fail. Show no credentials in lockfiles, output, caches or images.
5. Separate personal/work stores and exact image/CA/profile evidence. Lockfile
   integrity is portable only if the mirror serves the same admitted bytes.

No real JFrog endpoint, Curation policy or credentials were supplied. Synthetic
unit tests cover profile/source validation and CA material, **not** real JFrog
admission or runtime TLS integration. Those remain explicit acceptance gaps.

## OpenShell corporate CAs: separate trust paths

- **CLI → gateway:** use the gateway's enrolled server-CA bundle in the isolated
  CLI gateway `mtls/ca.crt`; retain hostname verification. A client certificate/key
  is identity, not a CA bundle; enroll it separately. Do not broaden client trust
  to an entire corporate CA without reviewing which principals become authorized.
- **Gateway → supervisor / sandbox JWT:** explicit `guest_tls_ca/cert/key` is
  supervisor transport identity; gateway JWT signing is independently configured.
  Worker commands must not read either private material. Temporary local PKI tests
  are not corporate enrollment.
- **Host → OCI/registry/interceptors:** configure only supported per-component CA
  settings from the pinned OpenShell API. Interceptors have `tls_ca_cert_path`.
  Do not assume a generic Node CA variable controls Rust/OCI transport.
- **Guest package tools/proxy:** public CA certificates may be added to a scoped,
  reproducible image trust bundle or supported per-tool trust setting. Requalify
  interception/hostname checks and egress policy for that exact image/profile.
  OpenShell 0.0.116 documents `proxy_ca_bundle` for container drivers; this is **not
  proof of native VM driver support**. Native VM corporate-proxy/CA delivery is
  unverified and must fail closed until tested.

Never disable TLS verification, firewalld, SELinux, or mutate system-wide host
trust to make a probe pass. The planner rejects non-CA, expired and key-bearing
bundles. Certificate validation alone does not establish corporate authorization
or prove actual OpenShell/registry TLS behavior.
