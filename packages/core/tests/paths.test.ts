import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { registryDirectory } from "../src/paths.js";

const cli = fileURLToPath(new URL("../src/cli.js", import.meta.url));

test("state path precedence is explicit override, XDG_STATE_HOME, then HOME state", () => {
  assert.equal(
    registryDirectory("personal", undefined, { HOME: "/home/operator" }),
    "/home/operator/.local/state/pi-workbench/profiles/personal",
  );
  assert.equal(
    registryDirectory("work", undefined, {
      HOME: "/home/operator",
      XDG_STATE_HOME: "/state",
    }),
    "/state/pi-workbench/profiles/work",
  );
  assert.equal(
    registryDirectory("work", "/isolated", { XDG_STATE_HOME: "invalid" }),
    "/isolated",
  );
  assert.throws(() => registryDirectory("work", "relative"), /absolute/);
  assert.throws(
    () => registryDirectory("work", undefined, { XDG_STATE_HOME: "relative" }),
    /absolute/,
  );
  assert.throws(
    () => registryDirectory("personal", undefined, { HOME: "relative" }),
    /absolute/,
  );
});

test("CLI init uses consistent private XDG locations without creating state during reads/help", (t) => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "workbench-xdg-")));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const home = join(root, "home"),
    xdg = join(root, "custom-state");
  const piState = join(root, "pi-owned", ".local");
  mkdirSync(piState, { recursive: true });
  writeFileSync(join(piState, "sentinel"), "Pi state remains untouched");
  const call = (args: string[], extra: NodeJS.ProcessEnv = {}) =>
    spawnSync(process.execPath, [cli, ...args], {
      env: {
        HOME: home,
        PATH: "/usr/bin:/bin",
        PI_CODING_AGENT_DIR: piState,
        PI_CODING_AGENT_SESSION_DIR: piState,
        ...extra,
      },
      encoding: "utf8",
      timeout: 5_000,
    });
  assert.equal(call(["--help"]).status, 0);
  assert.equal(call(["--profile", "personal", "list"]).status, 1);
  assert.equal(existsSync(home), false);
  assert.equal(call(["--profile", "personal", "init"]).status, 0);
  const directory = registryDirectory("personal", undefined, { HOME: home });
  assert.equal(
    statSync(join(directory, "registry.sqlite")).mode & 0o777,
    0o600,
  );
  assert.equal(statSync(directory).mode & 0o777, 0o700);
  assert.equal(
    call(["--profile", "work", "init"], { XDG_STATE_HOME: xdg }).status,
    0,
  );
  assert.ok(
    existsSync(join(xdg, "pi-workbench/profiles/work/registry.sqlite")),
  );
  const isolated = join(root, "override");
  assert.equal(
    call(["--state", isolated, "--profile", "personal", "init"], {
      XDG_STATE_HOME: "relative",
    }).status,
    0,
  );
  assert.ok(existsSync(join(isolated, "registry.sqlite")));
  assert.deepEqual(readdirSync(piState), ["sentinel"]);
  assert.equal(
    readFileSync(join(piState, "sentinel"), "utf8"),
    "Pi state remains untouched",
  );
});
