"use strict";

/**
 * Remove school-wide fees.defaultMonthlyFee from stored settings.
 * Billing uses class Fee Structure only; no school fallback remains.
 * Does not touch student_fee_months, payments, or fee_structures.
 */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        `
        UPDATE school_settings
           SET value = value - 'defaultMonthlyFee'
         WHERE key = 'fees'
           AND value ? 'defaultMonthlyFee'
        `,
        { transaction },
      );
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        `
        UPDATE school_settings
           SET value = jsonb_set(
             COALESCE(value, '{}'::jsonb),
             '{defaultMonthlyFee}',
             '8500'::jsonb,
             true
           )
         WHERE key = 'fees'
           AND NOT (value ? 'defaultMonthlyFee')
        `,
        { transaction },
      );
    });
  },
};
