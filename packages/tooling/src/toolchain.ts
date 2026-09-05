import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const pins = JSON.parse(
  readFileSync(
    new URL("../../../../config/foundation.json", import.meta.url),
    "utf8",
  ),
);
const pkg = JSON.parse(
  readFileSync(new URL("../../../../package.json", import.meta.url), "utf8"),
);
const lock = JSON.parse(
  readFileSync(
    new URL("../../../../package-lock.json", import.meta.url),
    "utf8",
  ),
);
assert.equal(
  process.versions.node,
  pins.node,
  "Node does not match the tested pin",
);
assert.equal(
  execFileSync("npm", ["--version"], { encoding: "utf8" }).trim(),
  pins.npm,
);
assert.equal(pkg.packageManager, `npm@${pins.npm}`);
assert.equal(pkg.engines.node, pins.node);
assert.equal(pkg.engines.npm, pins.npm);
assert.equal(
  readFileSync(
    new URL("../../../../.node-version", import.meta.url),
    "utf8",
  ).trim(),
  pins.node,
);
assert.equal(pkg.devDependencies["@earendil-works/pi-coding-agent"], pins.pi);
for (const [name, version] of Object.entries(pkg.devDependencies)) {
  assert.match(String(version), /^\d+\.\d+\.\d+$/, `${name} must be exact`);
  const installed = JSON.parse(
    readFileSync(
      new URL(`../../../../node_modules/${name}/package.json`, import.meta.url),
      "utf8",
    ),
  );
  assert.equal(installed.version, version, `${name}: installed version drift`);
  assert.equal(
    lock.packages[`node_modules/${name}`].version,
    version,
    `${name}: lock drift`,
  );
}
console.log(
  `toolchain pass: Node ${pins.node}, npm ${pins.npm}, Pi ${pins.pi}; exact direct dependencies`,
);
