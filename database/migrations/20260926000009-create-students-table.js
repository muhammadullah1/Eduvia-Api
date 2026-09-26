"use strict";
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("students", {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER },
      
      fk_school_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "schools", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      fk_class_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "classes", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      admission_no: { type: Sequelize.STRING, allowNull: false },
      first_name: { type: Sequelize.STRING, allowNull: false },
      last_name: { type: Sequelize.STRING, allowNull: false },
      gender: { type: Sequelize.ENUM("Male", "Female"), allowNull: true },
      dob: { type: Sequelize.DATEONLY, allowNull: true },
      status: {
        type: Sequelize.ENUM("Active", "Pending", "Withdrawn"),
        allowNull: false,
        defaultValue: "Pending",
      },
      admitted_on: { type: Sequelize.DATEONLY, allowNull: true },
      
      archived_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { allowNull: false, type: Sequelize.DATE },
      updated_at: { allowNull: false, type: Sequelize.DATE },
    });
    await queryInterface.addIndex("students", ["fk_school_id", "admission_no"], {
      unique: true,
      name: "students_school_admission_no_unique",
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable("students");
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_students_gender";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_students_status";');
  },
};
