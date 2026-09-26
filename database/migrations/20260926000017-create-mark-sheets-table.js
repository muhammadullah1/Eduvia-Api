"use strict";
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("mark_sheets", {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER },
      
      fk_school_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "schools", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      exam_name: { type: Sequelize.STRING, allowNull: false },
      fk_class_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "classes", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      fk_subject_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "subjects", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      subject: { type: Sequelize.STRING, allowNull: false },
      status: {
        type: Sequelize.ENUM("Draft", "Submitted", "Verified", "Published"),
        allowNull: false,
        defaultValue: "Draft",
      },
      max_score: { type: Sequelize.DECIMAL(8, 2), allowNull: false, defaultValue: 100 },
      
      archived_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { allowNull: false, type: Sequelize.DATE },
      updated_at: { allowNull: false, type: Sequelize.DATE },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable("mark_sheets");
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_mark_sheets_status";');
  },
};
