"use strict";
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("application_documents", {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER },
      fk_application_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "applications", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      label: { type: Sequelize.STRING, allowNull: false },
      status: {
        type: Sequelize.ENUM("Pending", "Uploaded", "Verified"),
        allowNull: false,
        defaultValue: "Pending",
      },
      
      archived_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { allowNull: false, type: Sequelize.DATE },
      updated_at: { allowNull: false, type: Sequelize.DATE },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable("application_documents");
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_application_documents_status";');
  },
};
