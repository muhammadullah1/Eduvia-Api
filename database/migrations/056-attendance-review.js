"use strict";

/**
 * Attendance review (SRS 6.3):
 * - adds `Late` to the attendance status enum (teachers already offer it);
 * - attendance_changes: one permanent row per change to a saved mark
 *   (from → to, reason, who, when). The app never updates or deletes them;
 * - attendance_reminders: a manager's reminder to a class's teacher that
 *   today's attendance is still pending (one per class per day).
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`ALTER TYPE "enum_attendances_status" ADD VALUE IF NOT EXISTS 'Late'`);
    await queryInterface.sequelize.transaction(async (transaction) => {
      const t = { transaction };
      const fk = (model, extra = {}) => ({
        type: Sequelize.INTEGER,
        references: { model, key: "id" },
        ...extra,
      });
      await queryInterface.createTable(
        "attendance_changes",
        {
          id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
          fk_school_id: fk("schools", { allowNull: false, onDelete: "CASCADE" }),
          fk_attendance_id: fk("attendances", { allowNull: true, onDelete: "SET NULL" }),
          fk_student_id: fk("students", { allowNull: false, onDelete: "CASCADE" }),
          fk_class_id: fk("classes", { allowNull: true, onDelete: "SET NULL" }),
          date: { type: Sequelize.DATEONLY, allowNull: false },
          from_status: { type: Sequelize.STRING(20), allowNull: false },
          to_status: { type: Sequelize.STRING(20), allowNull: false },
          reason: { type: Sequelize.TEXT, allowNull: true },
          source: { type: Sequelize.STRING(20), allowNull: false, defaultValue: "review" },
          fk_actor_user_id: fk("users", { allowNull: true, onDelete: "SET NULL" }),
          created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("now") },
          updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("now") },
        },
        t,
      );
      await queryInterface.addIndex("attendance_changes", ["fk_school_id", "created_at"], t);
      await queryInterface.addIndex("attendance_changes", ["fk_student_id", "date"], t);
      await queryInterface.createTable(
        "attendance_reminders",
        {
          id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
          fk_school_id: fk("schools", { allowNull: false, onDelete: "CASCADE" }),
          fk_class_id: fk("classes", { allowNull: false, onDelete: "CASCADE" }),
          date: { type: Sequelize.DATEONLY, allowNull: false },
          fk_teacher_user_id: fk("users", { allowNull: true, onDelete: "SET NULL" }),
          fk_sent_by_user_id: fk("users", { allowNull: true, onDelete: "SET NULL" }),
          created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("now") },
          updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("now") },
        },
        t,
      );
      await queryInterface.addIndex("attendance_reminders", ["fk_class_id", "date"], { unique: true, ...t });
    });
  },

  async down(queryInterface) {
    // `Late` stays in the enum: Postgres cannot drop an enum value, and marks may use it.
    await queryInterface.dropTable("attendance_reminders");
    await queryInterface.dropTable("attendance_changes");
  },
};
