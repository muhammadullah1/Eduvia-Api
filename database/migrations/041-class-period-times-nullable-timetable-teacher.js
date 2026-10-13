"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("classes", "period_start_times", {
      type: Sequelize.JSONB,
      allowNull: true,
    });

    await queryInterface.sequelize.query(`
      ALTER TABLE timetable_slots
      ALTER COLUMN fk_teacher_id DROP NOT NULL;
    `);
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("classes", "period_start_times");
    await queryInterface.sequelize.query(`
      ALTER TABLE timetable_slots
      ALTER COLUMN fk_teacher_id SET NOT NULL;
    `);
  },
};
