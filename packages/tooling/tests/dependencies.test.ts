import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "yaml";
import { validatePolicy, validateResolution } from "../src/dependencies.js";
import { validateSpecifier } from "../src/sources.js";

const integrity = `sha512-${"A".repeat(86)}==`;
test("registry integrity accepted, alternate or missing sources rejected", () => {
  validateResolution({ integrity });
  for (const resolution of [
    {},
    { integrity: "sha1-short" },
    { integrity, tarball: "https://attacker.invalid/code.tgz" },
    { directory: "../../private" },
    null,
  ]) {
    assert.throws(() => validateResolution(resolution));
  }
});
test("exact external pins; internal workspace references cannot leak to registry", () => {
  const names = new Set(["@pi-workbench/tooling"]);
  validateSpecifier("yaml", "2.9.0", names);
  validateSpecifier("@pi-workbench/tooling", "workspace:*", names);
  for (const spec of [
    "latest",
    "^2.8.3",
    "npm:other@2.8.3",
    "file:/home/user",
    "https://attacker.invalid/pkg.tgz",
    "git+ssh://attacker.invalid/pkg",
  ])
    assert.throws(() => validateSpecifier("yaml", spec, names));
  assert.throws(() =>
    validateSpecifier("@pi-workbench/tooling", "0.0.0", names),
  );
  assert.throws(() =>
    validateSpecifier("@pi-workbench/unknown", "workspace:*", names),
  );
});
test("policy cannot allow lifecycle execution, stale locks or age bypasses", () => {
  const policy = parse(
    readFileSync(
      new URL("../../../../pnpm-workspace.yaml", import.meta.url),
      "utf8",
    ),
  );
  validatePolicy(policy);
  for (const patch of [
    { ignoreScripts: false },
    { allowBuilds: { malicious: true } },
    { trustLockfile: true },
    { minimumReleaseAge: 0 },
    { minimumReleaseAgeExclude: ["*"] },
    { blockExoticSubdeps: false },
    { verifyDepsBeforeRun: "install" },
  ])
    assert.throws(() => validatePolicy({ ...policy, ...patch }));
});
