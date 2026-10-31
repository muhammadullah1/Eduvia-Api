"use strict";

/**
 * Preserve original bill snapshots (base/discount/net) and introduce collectible_amount
 * (= net + approved adjustments) for allocation, credit, and reports.
 */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.addColumn(
        "student_fee_months",
        "adjustment_total",
        {
          type: Sequelize.DECIMAL(12, 2),
          allowNull: false,
          defaultValue: 0,
        },
        { transaction }
      );
      await queryInterface.addColumn(
        "student_fee_months",
        "collectible_amount",
        {
          type: Sequelize.DECIMAL(12, 2),
          allowNull: true,
        },
        { transaction }
      );
      await queryInterface.addColumn(
        "student_fee_months",
        "concession_snapshot",
        {
          type: Sequelize.JSONB,
          allowNull: true,
        },
        { transaction }
      );

      await queryInterface.sequelize.query(
        `UPDATE student_fee_months
            SET collectible_amount = net_amount
          WHERE collectible_amount IS NULL`,
        { transaction }
      );

      await queryInterface.changeColumn(
        "student_fee_months",
        "collectible_amount",
        {
          type: Sequelize.DECIMAL(12, 2),
          allowNull: false,
        },
        { transaction }
      );

      await queryInterface.sequelize.query(
        `ALTER TABLE student_fee_months
           ADD CONSTRAINT student_fee_months_collectible_nonneg
             CHECK (collectible_amount >= 0)`,
        { transaction }
      );
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        `ALTER TABLE student_fee_months
           DROP CONSTRAINT IF EXISTS student_fee_months_collectible_nonneg`,
        { transaction }
      );
      await queryInterface.removeColumn("student_fee_months", "concession_snapshot", {
        transaction,
      });
      await queryInterface.removeColumn("student_fee_months", "collectible_amount", {
        transaction,
      });
      await queryInterface.removeColumn("student_fee_months", "adjustment_total", {
        transaction,
      });
    });
  },
};
