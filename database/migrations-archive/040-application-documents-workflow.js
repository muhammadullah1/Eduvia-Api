"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn("application_documents", "file_url", {
      type: Sequelize.STRING(500),
      allowNull: true,
    });

    await queryInterface.addColumn("application_documents", "status", {
      type: Sequelize.ENUM("Pending", "Uploaded", "Verified", "Rejected"),
      allowNull: false,
      defaultValue: "Pending",
    });

    await queryInterface.sequelize.query(
      `UPDATE application_documents SET status = 'Uploaded' WHERE file_url IS NOT NULL AND file_url != '' AND file_url NOT LIKE 'pending://%'`,
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("application_documents", "status");
    await queryInterface.changeColumn("application_documents", "file_url", {
      type: Sequelize.STRING(500),
      allowNull: false,
    });
  },
};
