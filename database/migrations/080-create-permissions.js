"use strict";

/**
 * Permission catalog. Rows mirror constants/permissions.js (the source of truth) and are
 * kept in sync on boot; role_permissions reference them by key.
 */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.createTable(
        "permissions",
        {
          id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: Sequelize.INTEGER,
          },
          key: {
            type: Sequelize.STRING(100),
            allowNull: false,
            unique: true,
          },
          module: {
            type: Sequelize.STRING(50),
            allowNull: false,
          },
          action: {
            type: Sequelize.STRING(30),
            allowNull: false,
          },
          label: {
            type: Sequelize.STRING(120),
            allowNull: false,
          },
          description: {
            type: Sequelize.TEXT,
            allowNull: false,
          },
          risk: {
            type: Sequelize.STRING(10),
            allowNull: false,
          },
          assignable_roles: {
            type: Sequelize.ARRAY(Sequelize.STRING(40)),
            allowNull: false,
            defaultValue: [],
          },
          created_at: {
            allowNull: false,
            type: Sequelize.DATE,
            defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
          },
          updated_at: {
            allowNull: false,
            type: Sequelize.DATE,
            defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
          },
        },
        { transaction },
      );

      await queryInterface.sequelize.query(
        `ALTER TABLE permissions
           ADD CONSTRAINT permissions_risk_check CHECK (risk IN ('low', 'medium', 'high'))`,
        { transaction },
      );
      await queryInterface.addIndex("permissions", ["module"], {
        name: "idx_permissions_module",
        transaction,
      });
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("permissions");
  },
};
