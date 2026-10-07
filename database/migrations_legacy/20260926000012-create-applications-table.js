"use strict";
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("applications", {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER },
      
      fk_school_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "schools", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      name: { type: Sequelize.STRING, allowNull: false },
      fk_class_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "classes", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      guardian: { type: Sequelize.STRING, allowNull: false },
      phone: { type: Sequelize.STRING, allowNull: false },
      dob: { type: Sequelize.DATEONLY, allowNull: true },
      gender: { type: Sequelize.ENUM("Male", "Female"), allowNull: true },
      address: { type: Sequelize.TEXT, allowNull: true },
      previous_school: { type: Sequelize.STRING, allowNull: true },
      previous_class: { type: Sequelize.STRING, allowNull: true },
      guardian_relation: { type: Sequelize.STRING, allowNull: true },
      guardian_address: { type: Sequelize.TEXT, allowNull: true },
      interview_type: { type: Sequelize.STRING, allowNull: true },
      interview_date: { type: Sequelize.DATEONLY, allowNull: true },
      interview_score: { type: Sequelize.STRING, allowNull: true },
      interview_result: { type: Sequelize.STRING, allowNull: true },
      decision: {
        type: Sequelize.ENUM("Admit", "Reject", "Waitlist"),
        allowNull: true,
      },
      status: {
        type: Sequelize.ENUM("New", "Review", "Waitlist", "Enrolled", "Rejected"),
        allowNull: false,
        defaultValue: "New",
      },
      submitted_on: { type: Sequelize.DATEONLY, allowNull: true },
      notes: { type: Sequelize.TEXT, allowNull: true },
      
      archived_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { allowNull: false, type: Sequelize.DATE },
      updated_at: { allowNull: false, type: Sequelize.DATE },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable("applications");
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_applications_gender";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_applications_decision";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_applications_status";');
  },
};
