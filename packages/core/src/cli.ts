import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { Command, CommanderError, Option } from "commander";
import { registryDirectory } from "./paths.js";
import { profile, Registry } from "./registry.js";

function generation(value: string): number {
  assert.match(
    value,
    /^(?:0|[1-9][0-9]*)$/,
    "expected numeric context generation",
  );
  const number = Number(value);
  assert.ok(Number.isSafeInteger(number), "invalid context generation");
  return number;
}

export function createCli(): Command {
  const program = new Command()
    .name("workbench")
    .description(
      "Local Work/Workspace registry. No worker execution or authorization.",
    )
    .option(
      "--state <directory>",
      "override absolute state directory (default: XDG state/pi-workbench/profiles/<profile>)",
    )
    .addOption(
      new Option("--profile <profile>", "explicit data profile")
        .choices(["personal", "work"])
        .makeOptionMandatory(),
    )
    .exitOverride()
    .showHelpAfterError();
  const execute = async (
    operation: (registry: Registry) => unknown,
    create = false,
    stored = false,
  ) => {
    const options = program.opts<{ state?: string; profile: string }>();
    const selectedProfile = profile(options.profile);
    const registry = await Registry.open(
      registryDirectory(selectedProfile, options.state),
      selectedProfile,
      create,
    );
    try {
      const result = await operation(registry);
      console.log(
        JSON.stringify(
          {
            scope: "local-registry-only-not-execution-authority",
            observation: stored ? "stored" : "command-result",
            result,
          },
          null,
          2,
        ),
      );
    } finally {
      registry.close();
    }
  };
  program
    .command("init")
    .description(
      "Initialize or migrate the private registry; never reset existing state",
    )
    .action(() =>
      execute(
        (registry) => ({
          profile: registry.profile,
          environmentId: registry.environmentId,
        }),
        true,
      ),
    );
  program
    .command("list")
    .description(
      "List stored Works, repositories, workspaces and context (may be stale)",
    )
    .action(() => execute((registry) => registry.list(), false, true));
  const work = program
    .command("work")
    .description("Track engineering objectives");
  work
    .command("create <name> <objective>")
    .description("Create a Work with a stable ID")
    .action((name: string, objective: string) =>
      execute((registry) => registry.createWork(name, objective)),
    );
  const workspace = program
    .command("workspace")
    .description("Adopt existing local Git checkouts; never edit source");
  workspace
    .command("adopt <work-id> <checkout-root>")
    .description("Register a committed checkout or Git worktree")
    .action((workId: string, root: string) =>
      execute((registry) => registry.adopt(workId, root)),
    );
  workspace
    .command("refresh <workspace-id>")
    .description(
      "Explicitly accept current HEAD/branch; invalidate earlier contexts",
    )
    .argument("<generation>", "expected stored context generation", generation)
    .action((workspaceId: string, expected: number) =>
      execute((registry) => registry.refresh(workspaceId, expected)),
    );
  const context = program
    .command("context")
    .description("Select or inspect a revision-bound workspace context");
  context
    .command("show")
    .description(
      "Restore selected context and check current checkout identity/revision",
    )
    .action(() => execute((registry) => registry.context()));
  context
    .command("select <workspace-id>")
    .description("Select explicitly; reject stale clients and checkout drift")
    .argument("<generation>", "expected stored context generation", generation)
    .action((workspaceId: string, expected: number) =>
      execute((registry) => registry.select(workspaceId, expected)),
    );
  return program;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  createCli()
    .parseAsync(process.argv)
    .catch((error: unknown) => {
      if (error instanceof CommanderError) {
        process.exitCode = error.exitCode;
      } else {
        console.error(
          JSON.stringify({
            error: error instanceof Error ? error.message : "registry failure",
          }),
        );
        process.exitCode = 1;
      }
    });
}
