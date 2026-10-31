"use strict";

/**
 * A concession reason can require a verified family (e.g. Sibling): the student must
 * be an active member of a verified family with at least one other active member.
 * Up adds the flag and turns it on for the seeded "Sibling" reason; down drops it.
 */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.addColumn(
        "school_concession_reasons",
        "requires_family",
        { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        { transaction },
      );
      await queryInterface.sequelize.query(
        "UPDATE school_concession_reasons SET requires_family = true WHERE lower(label) = 'sibling'",
        { transaction },
      );
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("school_concession_reasons", "requires_family");
  },
};
