module.exports = {
  env: {
    node: true,
    commonjs: true,
    es6: true,
    mocha: true,
    jest: true,
  },
  extends: "eslint:recommended",
  globals: {
    Atomics: "readonly",
    SharedArrayBuffer: "readonly",
  },
  parserOptions: {
    ecmaVersion: 2022,
  },
  rules: {},
  ignorePatterns: ["/client", "test.js"],
};
