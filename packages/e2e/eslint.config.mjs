import tsParser from "@typescript-eslint/parser";
import { rule } from "./eslint/e2e-authoring-rule.mjs";

export default [
  { ignores: ["tests/evidence/**"] },
  {
    files: ["tests/**/*.ts"],
    languageOptions: { parser: tsParser },
    plugins: { e2e: { rules: { "e2e-authoring-rule": rule } } },
    rules: {
      "e2e/e2e-authoring-rule": [
        "error",
        {
          testsDir: "tests",
          fixedWaitAllowedFiles: ["tests/fixtures/caption.ts"],
        },
      ],
    },
  },
];
