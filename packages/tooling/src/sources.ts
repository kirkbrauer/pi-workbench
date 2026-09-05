import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

/** No dependency imports: runs via Node type stripping BEFORE install. */
export function validateSpecifier(
  name: string,
  specifier: unknown,
  localNames: Set<string>,
): void {
  if (name.startsWith("@pi-workbench/")) {
    assert.ok(localNames.has(name), `unknown internal dependency ${name}`);
    assert.equal(
      specifier,
      "workspace:*",
      `${name}: internal dependencies cannot resolve from a registry`,
    );
  } else {
    assert.equal(typeof specifier, "string");
    assert.match(
      String(specifier),
      /^\d+\.\d+\.\d+$/,
      `${name}: exact registry version required; no aliases, Git, URLs or file sources`,
    );
  }
}

export function checkSources(root: string): void {
  for (const hook of [".pnpmfile.cjs", ".pnpmfile.mjs", ".pnpmfile.js"]) {
    assert.equal(
      existsSync(resolve(root, hook)),
      false,
      "executable package-manager hooks are forbidden",
    );
  }
  const paths = [
    "package.json",
    ...readdirSync(resolve(root, "packages"), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => `packages/${entry.name}/package.json`),
  ];
  const manifests = paths.map((path) =>
    JSON.parse(readFileSync(resolve(root, path), "utf8")),
  );
  const names = new Set<string>(manifests.map((manifest) => manifest.name));
  assert.equal(
    readFileSync(resolve(root, ".npmrc"), "utf8"),
    "registry=https://registry.npmjs.org/\n@pi-workbench:registry=https://registry.npmjs.org/\n",
    "unreviewed registry/auth configuration",
  );
  for (const manifest of manifests) {
    assert.equal(manifest.private, true, "publication is not authorized");
    for (const kind of [
      "dependencies",
      "devDependencies",
      "optionalDependencies",
      "peerDependencies",
    ]) {
      for (const [name, specifier] of Object.entries(manifest[kind] ?? {}))
        validateSpecifier(name, specifier, names);
    }
    for (const hook of ["preinstall", "install", "postinstall", "prepare"])
      assert.equal(manifest.scripts?.[hook], undefined, `no automatic ${hook}`);
    assert.equal(
      manifest.pnpm,
      undefined,
      "pnpm overrides/policy belong in reviewed workspace config",
    );
  }
  console.log(
    "source preflight pass: exact public registry dependencies; internal references workspace-only; no install hooks",
  );
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  checkSources(process.cwd());
