import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Allow `const { unwanted, ...rest } = obj` to strip a field
      // (e.g. stripping cost_price/password_hash before sending a
      // response) without flagging the intentionally-unused binding.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { ignoreRestSiblings: true, argsIgnorePattern: "^_" },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated Cloudflare Worker bundle (opennextjs-cloudflare build output) —
    // never hand-edited, not source code.
    ".open-next/**",
    ".wrangler/**",
  ]),
]);

export default eslintConfig;
