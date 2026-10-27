/**
 * Closes the Sequelize pool after each test file so Jest can exit cleanly
 * (files that already call sequelize.close() are unaffected: a second close is a no-op).
 */
afterAll(async () => {
  const { sequelize } = require("../../models");
  try {
    await sequelize.close();
  } catch {
    /* already closed */
  }
});
