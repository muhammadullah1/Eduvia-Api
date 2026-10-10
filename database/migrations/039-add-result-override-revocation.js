"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("result_visibility_overrides", "revoked_at", {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.addColumn("result_visibility_overrides", "fk_revoked_by_user_id", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: "users", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });
    await queryInterface.removeIndex("result_visibility_overrides", "idx_result_vis_overrides_exam_student_unique");
    await queryInterface.addIndex("result_visibility_overrides", ["fk_exam_id", "fk_student_id"], {
      unique: true,
      name: "idx_result_vis_overrides_active_unique",
      where: { revoked_at: null, archived_at: null },
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex("result_visibility_overrides", "idx_result_vis_overrides_active_unique");
    await queryInterface.addIndex("result_visibility_overrides", ["fk_exam_id", "fk_student_id"], {
      unique: true,
      name: "idx_result_vis_overrides_exam_student_unique",
    });
    await queryInterface.removeColumn("result_visibility_overrides", "fk_revoked_by_user_id");
    await queryInterface.removeColumn("result_visibility_overrides", "revoked_at");
  },
};
