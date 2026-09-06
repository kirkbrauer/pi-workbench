import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const sourcePath = "packages/tooling/src/__lint_fixture.ts";
const spacingRule = "@stylistic/padding-line-between-statements";

/** @param {string} source @param {string} [filePath] */
async function lint(source, filePath = sourcePath) {
  const [result] = await new ESLint({ cwd: root }).lintText(source, {
    filePath,
  });
  assert.ok(result);
  return result;
}

test("root rules require spacing between exported interfaces, types and functions", async () => {
  for (const source of [
    "export interface First { id: string; }\nexport interface Second { value: number; }\n",
    "export type First = string;\nexport type Second = number;\n",
    "export function first() { return 1; }\nexport function second() { return 2; }\n",
    "interface First { id: string; }\ninterface Second { value: number; }\n\nexport type Both = First & Second;\n",
  ]) {
    const result = await lint(source);
    assert.ok(
      result.messages.some((message) => message.ruleId === spacingRule),
    );
  }
  const result = await lint(
    "export interface First { id: string; }\n\nexport interface Second { value: number; }\n",
  );
  assert.equal(result.errorCount, 0);
  assert.equal(result.warningCount, 0);
});

test("recommended JS and TS rules reject real errors without custom suppressions", async () => {
  for (const [source, filePath, rule] of [
    ["debugger;\n", "example.mjs", "no-debugger"],
    ["missingGlobal();\n", "example.mjs", "no-undef"],
    ["const unused = 1;\n", sourcePath, "@typescript-eslint/no-unused-vars"],
    [
      "export type Unsafe = any;\n",
      sourcePath,
      "@typescript-eslint/no-explicit-any",
    ],
  ]) {
    assert.ok(source && filePath && rule);
    const result = await lint(source, filePath);
    assert.ok(result.messages.some((message) => message.ruleId === rule));
  }
});

test("ESLint spacing fixes are idempotent and preserved by pinned Biome", async () => {
  const first = "export interface First {\n  id: string;\n}\n";
  const second = "export interface Second {\n  value: number;\n}\n";
  const eslint = new ESLint({ cwd: root, fix: true });
  const [fixed] = await eslint.lintText(first + second, {
    filePath: sourcePath,
  });
  assert.ok(fixed);
  assert.equal(fixed.errorCount, 0);
  assert.equal(fixed.output, `${first}\n${second}`);
  const formatted = execFileSync(
    process.execPath,
    [
      fileURLToPath(
        new URL(
          "../../../node_modules/@biomejs/biome/bin/biome",
          import.meta.url,
        ),
      ),
      "format",
      `--stdin-file-path=${sourcePath}`,
      `--config-path=${root}biome.json`,
    ],
    {
      cwd: root,
      input: fixed.output,
      encoding: "utf8",
      timeout: 15_000,
      maxBuffer: 1024 * 1024,
    },
  );
  assert.equal(formatted, fixed.output);
  const repeated = await lint(formatted);
  assert.equal(repeated.errorCount, 0);
  assert.equal(repeated.warningCount, 0);
});

test("one root policy covers workspace source/tests and excludes generated/private trees", async () => {
  const eslint = new ESLint({ cwd: root });
  for (const path of [
    ".local/secret.ts",
    ".pi/extensions/private.ts",
    "node_modules/dependency/index.js",
    "packages/tooling/dist/src/generated.js",
    "coverage/output.js",
  ])
    assert.equal(await eslint.isPathIgnored(path), true, path);
  for (const path of [
    sourcePath,
    "packages/tooling/tests/example.test.ts",
    "packages/new-package/src/index.ts",
    "packages/eslint-typescript/index.mjs",
    "eslint.config.mjs",
  ])
    assert.equal(await eslint.isPathIgnored(path), false, path);
});

test("parser dependency is isolated; compiler and direct parser pins remain intact", () => {
  const compilerRequire = createRequire(
    new URL("../../../package.json", import.meta.url),
  );
  const parserRequire = createRequire(
    new URL("../package.json", import.meta.url),
  );
  const compiler = compilerRequire("typescript/package.json");
  const parser = parserRequire("typescript/package.json");
  const compilerPins = JSON.parse(
    readFileSync(new URL("../../../package.json", import.meta.url), "utf8"),
  );
  const parserPins = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  );
  assert.equal(compiler.version, compilerPins.devDependencies.typescript);
  assert.equal(compiler.version, "7.0.2");
  assert.equal(parser.version, parserPins.dependencies.typescript);
  assert.equal(parser.version, "6.0.3");
  assert.notEqual(
    compilerRequire.resolve("typescript"),
    parserRequire.resolve("typescript"),
  );
  assert.equal(
    parserRequire("typescript-eslint/package.json").version,
    parserPins.dependencies["typescript-eslint"],
  );
});
