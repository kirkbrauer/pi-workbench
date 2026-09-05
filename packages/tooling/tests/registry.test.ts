import assert from "node:assert/strict";
import { X509Certificate } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  registryInstallPlan,
  validateCaBundle,
  validateRegistryProfile,
} from "../src/registry.js";

const mirror = {
  id: "work-jfrog",
  registry: "https://jfrog.example.invalid/artifactory/api/npm/curated/",
  curation: "required",
};
test("mirror plan preserves path, TLS and admission qualification; no public fallback", () => {
  const profile = validateRegistryProfile({
    ...mirror,
    caBundleFile: "/operator/corporate-ca.pem",
  });
  const plan = registryInstallPlan(profile);
  assert.ok(plan.argv.includes(`--registry=${mirror.registry}`));
  assert.ok(plan.argv.includes("--strict-ssl=true"));
  assert.equal(plan.environment.COREPACK_NPM_REGISTRY, mirror.registry);
  assert.equal(
    plan.environment.NODE_EXTRA_CA_CERTS,
    "/operator/corporate-ca.pem",
  );
  assert.match(plan.qualification, /^blocked/);
  assert.ok(!JSON.stringify(plan).includes("registry.npmjs.org"));
});
test("reject insecure URLs, credentials, relative CA paths and uncurated private profiles", () => {
  for (const patch of [
    { registry: "http://jfrog.example.invalid/" },
    { registry: "https://user:secret@jfrog.example.invalid/" },
    { registry: "https://jfrog.example.invalid/?token=secret" },
    { caBundleFile: "../home.pem" },
    { curation: "not-applicable" },
    { token: "synthetic" },
  ])
    assert.throws(() => validateRegistryProfile({ ...mirror, ...patch }));
});
test("CA validation accepts synthetic CA, rejects key material, expiry and malformed bundles", () => {
  // Public synthetic certificate only; private key was discarded. No openssl runtime dependency.
  const cert = readFileSync(
    new URL("../../tests/fixtures/synthetic-ca.pem", import.meta.url),
    "utf8",
  );
  const parsed = new X509Certificate(cert);
  const validTime = Date.parse(parsed.validFrom) + 1000;
  assert.equal(validateCaBundle(cert, validTime).length, 1);
  assert.throws(() =>
    validateCaBundle(
      `${cert}\n-----BEGIN PRIVATE KEY-----\nsynthetic\n-----END PRIVATE KEY-----`,
      validTime,
    ),
  );
  assert.throws(() => validateCaBundle(cert, Date.parse(parsed.validTo) + 1));
  assert.throws(() => validateCaBundle(cert, Date.parse(parsed.validFrom) - 1));
  assert.throws(() => validateCaBundle("not a cert", validTime));
});
