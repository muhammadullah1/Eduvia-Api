"use strict";

/**
 * Allows the "fixed_payable" concession mode on student_fee_concessions.mode (the student pays a set amount).
 * Down restores the previous list and refuses while any row still uses fixed_payable.
 */

const TABLE = "student_fee_concessions";
const CONSTRAINT = "student_fee_concessions_mode_check";
const WITH_PAYABLE = "mode IN ('percent', 'fixed_discount', 'fixed_payable', 'waiver')";
const WITHOUT_PAYABLE = "mode IN ('percent', 'fixed_discount', 'waiver')";

async function replaceCheck(queryInterface, definition, transaction) {
  await queryInterface.sequelize.query(`ALTER TABLE ${TABLE} DROP CONSTRAINT ${CONSTRAINT}`, { transaction });
  await queryInterface.sequelize.query(`ALTER TABLE ${TABLE} ADD CONSTRAINT ${CONSTRAINT} CHECK (${definition})`, { transaction });
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction((transaction) => replaceCheck(queryInterface, WITH_PAYABLE, transaction));
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const [rows] = await queryInterface.sequelize.query(
        `SELECT count(*)::int AS n FROM ${TABLE} WHERE mode = 'fixed_payable'`,
        { transaction },
      );
      const [{ n }] = rows;
      if (n > 0) throw new Error(`${n} row(s) in ${TABLE} use fixed_payable; change them before rolling back.`);
      await replaceCheck(queryInterface, WITHOUT_PAYABLE, transaction);
    });
  },
};
