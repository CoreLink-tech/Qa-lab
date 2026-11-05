/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  env: { node: true, es2022: true },
  extends: ["eslint:recommended"],
  parserOptions: { ecmaVersion: 2022, sourceType: "script" },
  ignorePatterns: ["node_modules/", "apps/", "qa-lab-backend/", "coverage/"],
  rules: {
    "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    "no-empty": ["error", { allowEmptyCatch: true }],
    "no-constant-condition": ["error", { checkLoops: false }],
  },
};
