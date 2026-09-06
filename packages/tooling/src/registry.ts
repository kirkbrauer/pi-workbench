import assert from "node:assert/strict";
import { X509Certificate } from "node:crypto";
import { readFileSync } from "node:fs";
import { isAbsolute } from "node:path";
import { pathToFileURL } from "node:url";

export interface RegistryProfile {
  id: string;
  registry: string;
  curation: "required" | "not-applicable";
  caBundleFile?: string;
}

/** Operator-owned, non-secret input. Never discover profiles in candidate code. */
export function validateRegistryProfile(value: unknown): RegistryProfile {
  assert.ok(value && typeof value === "object" && !Array.isArray(value));
  const input = value as Record<string, unknown>;
  for (const key of Object.keys(input))
    assert.ok(
      ["id", "registry", "curation", "caBundleFile"].includes(key),
      `unknown profile field ${key}; credentials are forbidden`,
    );
  assert.equal(typeof input.id, "string");
  assert.match(String(input.id), /^[a-z][a-z0-9-]{0,63}$/);
  assert.equal(typeof input.registry, "string");
  const url = new URL(String(input.registry));
  assert.equal(url.protocol, "https:", "registry TLS is mandatory");
  assert.ok(
    !url.username && !url.password && !url.search && !url.hash,
    "no credentials/query/fragment in registry URLs",
  );
  assert.ok(url.pathname.endsWith("/"), "registry URL must end in /");
  assert.ok(
    input.curation === "required" || input.curation === "not-applicable",
  );
  if (url.hostname !== "registry.npmjs.org")
    assert.equal(
      input.curation,
      "required",
      "private mirrors require independently verified admission policy",
    );
  if (input.caBundleFile !== undefined) {
    assert.equal(typeof input.caBundleFile, "string");
    assert.ok(
      isAbsolute(String(input.caBundleFile)),
      "CA path must be operator-selected absolute path",
    );
  }
  return input as unknown as RegistryProfile;
}

/** Certificates only, never keys. Return fingerprints for evidence, not PEM contents. */
export function validateCaBundle(pem: string, now = Date.now()): string[] {
  const certificates =
    pem.match(
      /-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g,
    ) ?? [];
  assert.ok(certificates.length > 0, "CA bundle contains no certificates");
  assert.equal(
    pem
      .replace(
        /-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g,
        "",
      )
      .trim(),
    "",
    "bundle contains non-certificate material (possibly a private key)",
  );
  return certificates.map((value) => {
    const cert = new X509Certificate(value);
    assert.ok(cert.ca, "trust bundle entries must be CA certificates");
    assert.ok(
      Date.parse(cert.validFrom) <= now && now < Date.parse(cert.validTo),
      "CA is not currently valid",
    );
    return cert.fingerprint256;
  });
}

/** Plan only: no credential retrieval, install, trust promotion or public fallback. */
export function registryInstallPlan(profile: RegistryProfile): {
  argv: string[];
  environment: Record<string, string>;
  qualification: string;
} {
  const argv = [
    "pnpm",
    "install",
    "--frozen-lockfile",
    "--ignore-scripts",
    `--registry=${profile.registry}`,
    "--strict-ssl=true",
  ];
  const environment: Record<string, string> = {
    COREPACK_NPM_REGISTRY: profile.registry,
  };
  if (profile.caBundleFile) {
    argv.push(`--cafile=${profile.caBundleFile}`);
    environment.NODE_EXTRA_CA_CERTS = profile.caBundleFile;
  }
  return {
    argv,
    environment,
    qualification:
      profile.curation === "required"
        ? "blocked-until-mirror-curation-and-audit-integration-verified"
        : "public-registry-profile",
  };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  assert.equal(
    process.argv.length,
    3,
    "usage: pnpm registry:plan /absolute/operator/profile.json",
  );
  const path = process.argv[2];
  assert.ok(path && isAbsolute(path));
  const profile = validateRegistryProfile(
    JSON.parse(readFileSync(path, "utf8")),
  );
  const fingerprints = profile.caBundleFile
    ? validateCaBundle(readFileSync(profile.caBundleFile, "utf8"))
    : [];
  console.log(
    JSON.stringify(
      {
        profile: profile.id,
        ...registryInstallPlan(profile),
        caFingerprints: fingerprints,
      },
      null,
      2,
    ),
  );
}
