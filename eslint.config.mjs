import { defineConfig, globalIgnores } from "eslint/config";
import nextTs from "eslint-config-next/typescript";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import nextPlugin from "@next/eslint-plugin-next";

// NOTE: eslint-config-next/core-web-vitals includes eslint-plugin-react@7.x which
// uses context.getFilename() — a deprecated API removed in ESLint 10. We use only
// the TypeScript config until eslint-plugin-react is updated for ESLint 10 compatibility.

const eslintConfig = defineConfig([
  ...nextTs,
  {
    plugins: {
      "react-hooks": reactHooksPlugin,
      "@next/next": nextPlugin,
    },
    rules: {
      // TypeScript strictness
      "@typescript-eslint/no-unused-vars": ["error", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
      }],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/consistent-type-imports": ["error", { prefer: "type-imports", fixStyle: "inline-type-imports" }],

      // General code quality
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "eqeqeq": ["error", "always"],

      // Disable no-duplicate-imports — conflicts with `import type` splits which are idiomatic TS.
      // @typescript-eslint/consistent-type-imports already enforces the correct pattern.
      "no-duplicate-imports": "off",

      // Disable rules whose plugins conflict or aren't registered by eslint-config-next in flat config
      "react-hooks/exhaustive-deps": "off",
      "@next/next/no-img-element": "off",
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "eslint.config.mjs",
    "next.config.ts",
    "postcss.config.mjs",
    "prisma.config.ts",
    "prisma/**",
    "scripts/**",
    "src/generated/**",
  ]),
]);

export default eslintConfig;
