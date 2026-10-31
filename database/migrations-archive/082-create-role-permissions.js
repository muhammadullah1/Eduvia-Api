"use strict";

/**
 * Grants per school role. A role holds a permission when a row exists.
 */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.createTable(
        "role_permissions",
        {
          id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: Sequelize.INTEGER,
          },
          fk_role_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: {
              model: "roles",
              key: "id",
            },
            onUpdate: "CASCADE",
            onDelete: "CASCADE",
          },
          permission_key: {
            type: Sequelize.STRING(100),
            allowNull: false,
            references: {
              model: "permissions",
              key: "key",
            },
            onUpdate: "CASCADE",
            onDelete: "CASCADE",
          },
          fk_granted_by_user_id: {
            type: Sequelize.INTEGER,
            allowNull: true,
            references: {
              model: "users",
              key: "id",
            },
            onUpdate: "CASCADE",
            onDelete: "SET NULL",
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

      await queryInterface.addIndex("role_permissions", ["fk_role_id", "permission_key"], {
        name: "uq_role_permissions_role_key",
        unique: true,
        transaction,
      });
      await queryInterface.addIndex("role_permissions", ["permission_key"], {
        name: "idx_role_permissions_permission_key",
        transaction,
      });
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("role_permissions");
  },
};
