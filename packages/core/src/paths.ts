import assert from "node:assert/strict";
import { homedir } from "node:os";
import { isAbsolute, join } from "node:path";
import { type Profile, profile } from "./registry.js";

/** Consistent XDG state layout on supported macOS/Linux hosts; no filesystem effects. */
export function registryDirectory(
  selectedProfile: Profile,
  explicit?: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  profile(selectedProfile);
  if (explicit !== undefined) {
    assert.ok(isAbsolute(explicit), "--state requires an absolute directory");
    return explicit;
  }
  const home = env.HOME || homedir();
  const base = env.XDG_STATE_HOME || join(home, ".local", "state");
  assert.ok(
    isAbsolute(base),
    "XDG_STATE_HOME/HOME must resolve to an absolute path",
  );
  return join(base, "pi-workbench", "profiles", selectedProfile);
}
