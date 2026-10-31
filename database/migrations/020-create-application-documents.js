"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("application_documents", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      fk_application_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "applications", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      title: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      file_url: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      document_type: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      status: {
        type: Sequelize.ENUM("Pending", "Uploaded", "Verified", "Rejected"),
        allowNull: false,
        defaultValue: "Pending",
      },
    });

    await queryInterface.addIndex(
      "application_documents",
      ["fk_application_id", "title"],
      { name: "application_documents_application_title_unique", unique: true },
    );
    await queryInterface.addIndex(
      "application_documents",
      ["fk_application_id"],
      { name: "idx_application_docs_application" },
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable("application_documents");
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_application_documents_status";',
    );
  },
};
