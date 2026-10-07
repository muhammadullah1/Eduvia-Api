"use strict";
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("student_parents", {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER },
      fk_student_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "students", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      fk_parent_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "parents", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      is_primary: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      created_at: { allowNull: false, type: Sequelize.DATE },
      updated_at: { allowNull: false, type: Sequelize.DATE },
    });
    await queryInterface.addIndex("student_parents", ["fk_student_id", "fk_parent_id"], {
      unique: true,
      name: "student_parents_unique",
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable("student_parents");
  },
};
