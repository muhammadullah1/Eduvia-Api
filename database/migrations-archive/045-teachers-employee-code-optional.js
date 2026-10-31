"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn("teachers", "employee_code", {
      type: Sequelize.STRING(50),
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      "UPDATE teachers SET employee_code = 'T-' || id WHERE employee_code IS NULL",
    );
    await queryInterface.changeColumn("teachers", "employee_code", {
      type: Sequelize.STRING(50),
      allowNull: false,
    });
  },
};
