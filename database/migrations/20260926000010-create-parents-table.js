"use strict";
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("parents", {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER },
      fk_user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        unique: true,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      
      fk_school_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "schools", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      relation: { type: Sequelize.STRING, allowNull: false, defaultValue: "Guardian" },
      
      archived_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { allowNull: false, type: Sequelize.DATE },
      updated_at: { allowNull: false, type: Sequelize.DATE },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable("parents");
  },
};
