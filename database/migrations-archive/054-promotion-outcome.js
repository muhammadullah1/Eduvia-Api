"use strict";

/**
 * Bulk promotion records hold-backs as well as promotions, so each
 * student_promotions row says what happened. Existing rows were all promotions.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("student_promotions", "outcome", {
      type: Sequelize.STRING(20),
      allowNull: false,
      defaultValue: "Promoted",
    });
    await queryInterface.addIndex("student_promotions", ["fk_school_id", "promoted_on"], {
      name: "idx_student_promotions_school_date",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex("student_promotions", "idx_student_promotions_school_date");
    await queryInterface.removeColumn("student_promotions", "outcome");
  },
};
