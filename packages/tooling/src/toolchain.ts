import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const root = new URL("../../../../", import.meta.url);
const pins = JSON.parse(
  readFileSync(new URL("config/foundation.json", root), "utf8"),
);
const pkg = JSON.parse(readFileSync(new URL("package.json", root), "utf8"));
assert.equal(
  process.versions.node,
  pins.node,
  "Node does not match the tested pin",
);
assert.equal(
  execFileSync("corepack", ["--version"], { encoding: "utf8" }).trim(),
  pins.corepack,
);
assert.equal(
  execFileSync("pnpm", ["--version"], { encoding: "utf8" }).trim(),
  pins.pnpm,
);
assert.match(
  pkg.packageManager,
  new RegExp(
    `^pnpm@${pins.pnpm.replaceAll(".", "\\.")}\\+sha512\\.[a-f0-9]{128}$`,
  ),
);
assert.equal(pkg.engines.node, pins.node);
assert.equal(pkg.engines.pnpm, pins.pnpm);
assert.equal(
  readFileSync(new URL(".node-version", root), "utf8").trim(),
  pins.node,
);
assert.equal(pkg.devDependencies["@earendil-works/pi-coding-agent"], pins.pi);
for (const [name, version] of Object.entries(pkg.devDependencies)) {
  assert.match(String(version), /^\d+\.\d+\.\d+$/, `${name} must be exact`);
  const installed = JSON.parse(
    readFileSync(new URL(`node_modules/${name}/package.json`, root), "utf8"),
  );
  assert.equal(installed.version, version, `${name}: installed version drift`);
}
console.log(
  `toolchain pass: Node ${pins.node}, pnpm ${pins.pnpm}, Pi ${pins.pi}; exact direct dependencies`,
);
