module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true,
  },
  extends: ["eslint:recommended", "plugin:react/recommended", "plugin:react-hooks/recommended"],
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    ecmaFeatures: { jsx: true },
  },
  ignorePatterns: ["build", "node_modules"],
  settings: {
    react: { version: "detect" },
  },
  rules: {
    "react/react-in-jsx-scope": "off",
    "react/prop-types": "off",
    "react/no-unknown-property": "off",
    "react/no-unescaped-entities": "off",
    "no-unused-vars": "off",
    "no-empty": ["error", { allowEmptyCatch: true }],
  },
  overrides: [
    {
      files: ["*.config.js", "*.config.cjs", ".eslintrc.cjs"],
      env: { node: true },
    },
  ],
};
