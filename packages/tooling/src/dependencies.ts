import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { parse } from "yaml";
import { checkSources } from "./sources.js";

function record(value: unknown): Record<string, unknown> {
  assert.ok(
    value !== null && typeof value === "object" && !Array.isArray(value),
    "expected mapping",
  );
  return value as Record<string, unknown>;
}

/** Only registry tarballs bound to sha512 integrity are admitted in this foundation. */
export function validateResolution(value: unknown): void {
  const resolution = record(value);
  assert.deepEqual(
    Object.keys(resolution),
    ["integrity"],
    "Git, tarball URL, directory and other resolution forms are forbidden",
  );
  assert.equal(typeof resolution.integrity, "string");
  assert.match(
    String(resolution.integrity),
    /^sha512-[A-Za-z0-9+/]{86}==$/,
    "sha512 integrity required",
  );
}

export function validatePolicy(value: unknown): void {
  const policy = record(value);
  const required = {
    ignoreScripts: true,
    allowBuilds: {},
    strictDepBuilds: true,
    enablePrePostScripts: false,
    verifyDepsBeforeRun: "error",
    minimumReleaseAge: 1440,
    minimumReleaseAgeStrict: true,
    minimumReleaseAgeIgnoreMissingTime: false,
    trustLockfile: false,
    trustPolicy: "no-downgrade",
    blockExoticSubdeps: true,
    verifyStoreIntegrity: true,
    strictStorePkgContentCheck: true,
    sideEffectsCache: false,
    nodeLinker: "isolated",
    hoist: false,
    shamefullyHoist: false,
    autoInstallPeers: false,
    strictPeerDependencies: true,
    linkWorkspacePackages: false,
    storeDir: ".local/pnpm-store",
  };
  for (const [key, expected] of Object.entries(required))
    assert.deepEqual(
      policy[key],
      expected,
      `${key}: supply-chain policy drift`,
    );
  for (const key of [
    "trustPolicyExclude",
    "trustPolicyIgnoreAfter",
    "minimumReleaseAgeExclude",
    "dangerouslyAllowAllBuilds",
    "registries",
    "packageConfigs",
    "pnpmfile",
    "globalPnpmfile",
  ]) {
    assert.equal(
      policy[key],
      undefined,
      `${key}: unreviewed exception or executable hook`,
    );
  }
  assert.deepEqual(policy.overrides, {
    "@types/node@22.20.1>undici-types": "6.28.1",
  });
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  checkSources(process.cwd());
  validatePolicy(parse(readFileSync("pnpm-workspace.yaml", "utf8")));
  const lock = record(parse(readFileSync("pnpm-lock.yaml", "utf8")));
  assert.equal(lock.lockfileVersion, "9.0");
  const packages = record(lock.packages);
  assert.ok(Object.keys(packages).length > 0, "empty lock is not evidence");
  for (const [name, entry] of Object.entries(packages)) {
    assert.match(
      name,
      /^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+@\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/,
      "non-registry package identity",
    );
    validateResolution(record(entry).resolution);
  }
  console.log(
    `dependency policy pass: ${Object.keys(packages).length} integrity-bound registry entries; no approved install scripts`,
  );
}
