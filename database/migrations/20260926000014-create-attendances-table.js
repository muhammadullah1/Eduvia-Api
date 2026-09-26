"use strict";
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("attendances", {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER },
      fk_student_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "students", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      fk_class_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "classes", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      date: { type: Sequelize.DATEONLY, allowNull: false },
      status: {
        type: Sequelize.ENUM("Present", "Absent", "Leave"),
        allowNull: false,
      },
      
      archived_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { allowNull: false, type: Sequelize.DATE },
      updated_at: { allowNull: false, type: Sequelize.DATE },
    });
    await queryInterface.addIndex("attendances", ["fk_student_id", "date"], {
      unique: true,
      name: "attendances_student_date_unique",
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable("attendances");
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_attendances_status";');
  },
};
