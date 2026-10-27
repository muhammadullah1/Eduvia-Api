module.exports = {
  testEnvironment: "node",
  rootDir: "..",
  testMatch: ["**/tests/**/*.test.js"],
  setupFilesAfterEnv: ["<rootDir>/tests/helpers/close-db.js"],
  forceExit: true,
};
