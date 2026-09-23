import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Standalone Node CLI scripts (plain CommonJS, run directly via `node db/...`), not part of
    // the Next.js app bundle -- same category as the above, not this app's TS/ESM code.
    "db/**",
  ]),
]);

export default eslintConfig;
