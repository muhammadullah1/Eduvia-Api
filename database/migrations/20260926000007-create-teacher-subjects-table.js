"use strict";
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("teacher_subjects", {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER },
      fk_teacher_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "teachers", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      fk_subject_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "subjects", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      created_at: { allowNull: false, type: Sequelize.DATE },
      updated_at: { allowNull: false, type: Sequelize.DATE },
    });
    await queryInterface.addIndex("teacher_subjects", ["fk_teacher_id", "fk_subject_id"], {
      unique: true,
      name: "teacher_subjects_unique",
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable("teacher_subjects");
  },
};
