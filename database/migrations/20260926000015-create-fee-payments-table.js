"use strict";
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("fee_payments", {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER },
      
      fk_school_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "schools", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      ref: { type: Sequelize.STRING, allowNull: false, unique: true },
      fk_student_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "students", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      period: { type: Sequelize.STRING, allowNull: false },
      type: { type: Sequelize.STRING, allowNull: false },
      amount: { type: Sequelize.DECIMAL(12, 2), allowNull: false },
      method: { type: Sequelize.STRING, allowNull: true },
      status: {
        type: Sequelize.ENUM("Paid", "Pending"),
        allowNull: false,
        defaultValue: "Pending",
      },
      paid_on: { type: Sequelize.DATEONLY, allowNull: true },
      
      archived_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { allowNull: false, type: Sequelize.DATE },
      updated_at: { allowNull: false, type: Sequelize.DATE },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable("fee_payments");
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_fee_payments_status";');
  },
};
