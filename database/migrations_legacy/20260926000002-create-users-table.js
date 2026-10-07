"use strict";
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("users", {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER },
      
      fk_school_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "schools", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      first_name: { type: Sequelize.STRING, allowNull: false },
      last_name: { type: Sequelize.STRING, allowNull: false },
      email: { type: Sequelize.STRING, allowNull: false, unique: true },
      phone: { type: Sequelize.STRING, allowNull: true },
      password: { type: Sequelize.STRING(255), allowNull: true },
      gender: { type: Sequelize.ENUM("Male", "Female", "Other"), allowNull: true },
      photo: { type: Sequelize.STRING, allowNull: true },
      role: { type: Sequelize.ENUM("management", "teacher", "parent"), allowNull: false },
      status: {
        type: Sequelize.ENUM("active", "in_active", "pending", "block"),
        defaultValue: "in_active",
        allowNull: false,
      },
      last_login: { type: Sequelize.DATE, allowNull: true },
      date_of_birth: { type: Sequelize.DATEONLY, allowNull: true },
      archived_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      
      archived_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { allowNull: false, type: Sequelize.DATE },
      updated_at: { allowNull: false, type: Sequelize.DATE },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable("users");
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_users_gender";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_users_role";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_users_status";');
  },
};
