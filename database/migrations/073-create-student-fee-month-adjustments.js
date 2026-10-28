"use strict";

/**
 * Auditable adjustment ledger for existing bills. Original base/discount/net stay immutable.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.createTable(
        "student_fee_month_adjustments",
        {
          id: { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER },
          fk_school_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: { model: "schools", key: "id" },
            onUpdate: "CASCADE",
            onDelete: "CASCADE",
          },
          fk_fee_month_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: { model: "student_fee_months", key: "id" },
            onUpdate: "CASCADE",
            onDelete: "CASCADE",
          },
          fk_student_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: { model: "students", key: "id" },
            onUpdate: "CASCADE",
            onDelete: "CASCADE",
          },
          delta_collectible: { type: Sequelize.DECIMAL(12, 2), allowNull: false },
          reason: { type: Sequelize.TEXT, allowNull: false },
          status: { type: Sequelize.STRING(30), allowNull: false, defaultValue: "PendingApproval" },
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
          created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn("NOW") },
          updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn("NOW") },
        },
        { transaction },
      );
      const q = (sql) => queryInterface.sequelize.query(sql, { transaction });
      await q(`ALTER TABLE student_fee_month_adjustments
        ADD CONSTRAINT student_fee_month_adjustments_status_check
          CHECK (status IN ('Draft','PendingApproval','Approved','Rejected','Voided')),
        ADD CONSTRAINT student_fee_month_adjustments_delta_check CHECK (delta_collectible <> 0)`);
      await q(`CREATE INDEX idx_fee_month_adjustments_month ON student_fee_month_adjustments (fk_fee_month_id, status)`);
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("student_fee_month_adjustments");
  },
};
