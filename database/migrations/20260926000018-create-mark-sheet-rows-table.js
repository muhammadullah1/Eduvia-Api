"use strict";
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("mark_sheet_rows", {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER },
      fk_mark_sheet_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "mark_sheets", key: "id" },
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
      score: { type: Sequelize.DECIMAL(8, 2), allowNull: true },
      created_at: { allowNull: false, type: Sequelize.DATE },
      updated_at: { allowNull: false, type: Sequelize.DATE },
    });
    await queryInterface.addIndex("mark_sheet_rows", ["fk_mark_sheet_id", "fk_student_id"], {
      unique: true,
      name: "mark_sheet_rows_unique",
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable("mark_sheet_rows");
  },
};
