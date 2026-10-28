"use strict";

/**
 * Flexible student fee concessions with approval workflow.
 * Bills snapshot applied concessions at generation; existing months are never rewritten.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.createTable(
        "student_fee_concessions",
        {
          id: { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER },
          fk_school_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: { model: "schools", key: "id" },
            onUpdate: "CASCADE",
            onDelete: "CASCADE",
          },
          fk_session_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: { model: "academic_sessions", key: "id" },
            onUpdate: "CASCADE",
            onDelete: "RESTRICT",
          },
          fk_student_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: { model: "students", key: "id" },
            onUpdate: "CASCADE",
            onDelete: "CASCADE",
          },
          fk_family_id: {
            type: Sequelize.INTEGER,
            allowNull: true,
            references: { model: "families", key: "id" },
            onUpdate: "CASCADE",
            onDelete: "SET NULL",
          },
          category: { type: Sequelize.STRING(30), allowNull: false, defaultValue: "Standard" },
          mode: { type: Sequelize.STRING(30), allowNull: false },
          value: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
          priority: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 100 },
          stackable: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
          max_discount_amount: { type: Sequelize.DECIMAL(12, 2), allowNull: true },
          effective_from: { type: Sequelize.DATEONLY, allowNull: false },
          effective_to: { type: Sequelize.DATEONLY, allowNull: true },
          status: { type: Sequelize.STRING(30), allowNull: false, defaultValue: "Draft" },
          reason: { type: Sequelize.TEXT, allowNull: true },
          fk_requested_by_user_id: {
            type: Sequelize.INTEGER,
            allowNull: true,
            references: { model: "users", key: "id" },
            onUpdate: "CASCADE",
            onDelete: "SET NULL",
          },
          fk_approved_by_user_id: {
            type: Sequelize.INTEGER,
            allowNull: true,
            references: { model: "users", key: "id" },
            onUpdate: "CASCADE",
            onDelete: "SET NULL",
          },
          approved_at: { type: Sequelize.DATE, allowNull: true },
          rejection_reason: { type: Sequelize.TEXT, allowNull: true },
          notes: { type: Sequelize.TEXT, allowNull: true },
          created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn("NOW") },
          updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn("NOW") },
          archived_at: { type: Sequelize.DATE, allowNull: true },
        },
        { transaction },
      );
      const q = (sql) => queryInterface.sequelize.query(sql, { transaction });
      await q(`ALTER TABLE student_fee_concessions
        ADD CONSTRAINT student_fee_concessions_category_check CHECK (category IN ('Standard','Scholarship','Sibling','Other')),
        ADD CONSTRAINT student_fee_concessions_mode_check CHECK (mode IN ('fixed_payable','fixed_discount','percent','waiver')),
        ADD CONSTRAINT student_fee_concessions_status_check CHECK (status IN ('Draft','PendingApproval','Approved','Rejected','Revoked')),
        ADD CONSTRAINT student_fee_concessions_value_check CHECK (value >= 0)`);
      await q(`CREATE INDEX idx_concessions_student_session ON student_fee_concessions (fk_student_id, fk_session_id, status) WHERE archived_at IS NULL`);
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("student_fee_concessions");
  },
};
