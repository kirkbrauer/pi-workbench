import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

/** Structural DCO only, not proof of review or disclosed AI use.
 * `trailers` is the output of git interpret-trailers --parse.
 */
export function validateTrailers(author: string, trailers: string): string[] {
  const lines = trailers.trim().split("\n");
  const errors = [];
  if (
    !lines.some(
      (line) => line.toLowerCase() === `signed-off-by: ${author}`.toLowerCase(),
    )
  ) {
    errors.push("missing author DCO sign-off");
  }
  if (
    lines.some((line) =>
      /^co-authored-by:.*<(?:noreply@(?:anthropic|openai)\.com|pi@agents\.invalid)>$/i.test(
        line,
      ),
    )
  ) {
    errors.push("unconverted AI co-author trailer");
  }
  if (
    lines.some(
      (line) =>
        /^assisted-by:/i.test(line) &&
        !/^assisted-by: [A-Za-z0-9._+-]+(?::[A-Za-z0-9._+-]+)?(?: \S+)*$/i.test(
          line,
        ),
    )
  ) {
    errors.push("malformed assistance trailer");
  }
  return errors;
}

function git(args: string[]): string {
  return execFileSync("git", args, { encoding: "utf8", timeout: 15000 }).trim();
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  // Range comes from trusted GitHub event SHAs, never an interpolated shell command.
  const [base, head] = process.argv.slice(2);
  if (
    !base ||
    !head ||
    !/^[a-f0-9]{40}$/.test(base) ||
    !/^[a-f0-9]{40}$/.test(head)
  ) {
    throw new Error("usage: npm run check:commits -- <base SHA> <head SHA>");
  }
  git(["merge-base", "--is-ancestor", base, head]);
  const commits = git(["rev-list", "--no-merges", `${base}..${head}`])
    .split("\n")
    .filter(Boolean);
  if (!commits.length) throw new Error("empty candidate range is not evidence");
  let failures = 0;
  for (const sha of commits) {
    const author = git(["show", "-s", "--format=%an <%ae>", sha]);
    const message = git(["show", "-s", "--format=%B", sha]);
    const trailers = execFileSync("git", ["interpret-trailers", "--parse"], {
      input: message,
      encoding: "utf8",
    });
    const errors = validateTrailers(author, trailers);
    failures += errors.length;
    console.log(`${sha}: ${errors.length ? errors.join("; ") : "pass"}`);
  }
  // Matches upstream: merge commits are not rewritten/signed off by local hooks.
  process.exitCode = failures ? 1 : 0;
}
