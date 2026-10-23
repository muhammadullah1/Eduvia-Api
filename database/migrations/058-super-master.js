"use strict";

/**
 * Super Master (EDUVIA-14): every class has one explicitly assigned teacher who is
 * responsible for its attendance for the whole school day.
 * - classes.fk_super_master_teacher_id: a single nullable column, so the database itself
 *   guarantees at most one Super Master per class. NULL means "not assigned yet".
 *   Deleting a teacher row clears the assignment (SET NULL); archived/inactive teachers
 *   are treated as unassigned at runtime.
 * - attendance_reminders.read_at: when the recipient teacher opened the reminder.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.addColumn(
        "classes",
        "fk_super_master_teacher_id",
        { type: Sequelize.INTEGER, allowNull: true, references: { model: "teachers", key: "id" }, onUpdate: "CASCADE", onDelete: "SET NULL" },
        { transaction },
      );
      await queryInterface.addIndex("classes", ["fk_super_master_teacher_id"], { name: "classes_super_master_idx", transaction });
      await queryInterface.addColumn("attendance_reminders", "read_at", { type: Sequelize.DATE, allowNull: true }, { transaction });
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.removeColumn("attendance_reminders", "read_at", { transaction });
      await queryInterface.removeIndex("classes", "classes_super_master_idx", { transaction });
      await queryInterface.removeColumn("classes", "fk_super_master_teacher_id", { transaction });
    });
  },
};
