"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const statuses = ["Scheduled", "Marks Pending", "Finalised"];
    for (const status of statuses) {
      await queryInterface.sequelize.query(
        `ALTER TYPE "enum_exams_status" ADD VALUE IF NOT EXISTS '${status}'`
      );
    }

    await queryInterface.addColumn("exams", "exam_type", {
      type: Sequelize.STRING(40),
      allowNull: false,
      defaultValue: "Mid-Term",
    });
    await queryInterface.addColumn("exams", "total_marks", {
      type: Sequelize.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 100,
    });
    await queryInterface.addColumn("exams", "passing_marks", {
      type: Sequelize.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 40,
    });
    await queryInterface.addColumn("mark_sheet_rows", "is_exempt", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("mark_sheet_rows", "is_exempt");
    await queryInterface.removeColumn("exams", "passing_marks");
    await queryInterface.removeColumn("exams", "total_marks");
    await queryInterface.removeColumn("exams", "exam_type");
  },
};
