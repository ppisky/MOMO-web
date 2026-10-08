import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

export default tseslint.config(
  {
    ignores: [
      "build/**",
      "dist-electron/**",
      "release/**",
      "node_modules/**",
      "playwright-report/**",
      "test-results/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { languageOptions: { globals: { ...globals.browser, ...globals.node } } },
  {
    files: [
      "app/components/**/*.{ts,tsx}",
      "app/features/**/*.{ts,tsx}",
      "app/platform/**/*.{ts,tsx}",
      "shared/**/*.ts",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            "node:*",
            "electron",
            "**/*.server",
            "**/*.server.ts",
            "@remix-run/node",
          ],
        },
      ],
    },
  },
);
