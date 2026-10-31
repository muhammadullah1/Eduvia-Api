"use strict";

/**
 * Weekly test days carry the test's total marks (model: daily_test_schedules.total_marks).
 * Some databases already have the column from an earlier sync, so it is added only when missing.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const columns = await queryInterface.describeTable("daily_test_schedules");
    if (columns.total_marks) return;
    await queryInterface.addColumn("daily_test_schedules", "total_marks", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 20,
    });
  },

  async down() {
    // The column may predate this migration, so it is left in place.
  },
};
