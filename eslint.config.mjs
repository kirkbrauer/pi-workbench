import js from "@eslint/js";
import stylistic from "@stylistic/eslint-plugin";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import tseslint from "./packages/eslint-typescript/index.mjs";

const sourceFiles = ["**/*.{js,cjs,mjs,jsx,ts,cts,mts,tsx}"];
const declarations = [
  "interface",
  "type",
  "function",
  "class",
  "enum",
  "export",
];

export default defineConfig(
  globalIgnores([
    "**/.git/**",
    "**/node_modules/**",
    "**/.local/**",
    "**/dist/**",
    "**/coverage/**",
    "**/.pi/**",
  ]),
  {
    name: "workbench/javascript-recommended",
    files: sourceFiles,
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.node },
  },
  {
    name: "workbench/typescript-recommended",
    files: ["**/*.{ts,cts,mts,tsx}"],
    extends: [tseslint.configs.recommended],
  },
  {
    name: "workbench/declaration-spacing",
    files: sourceFiles,
    plugins: { "@stylistic": stylistic },
    rules: {
      "@stylistic/padding-line-between-statements": [
        "error",
        { blankLine: "always", prev: "*", next: declarations },
        { blankLine: "always", prev: declarations, next: "*" },
      ],
    },
  },
);
