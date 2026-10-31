"use strict";

/**
 * Per-school roles. Today every school has the five system roles; `is_system` and the
 * (school, key) uniqueness leave room for custom roles later. `version` guards concurrent edits.
 */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.createTable(
        "roles",
        {
          id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: Sequelize.INTEGER,
          },
          fk_school_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: {
              model: "schools",
              key: "id",
            },
            onUpdate: "CASCADE",
            onDelete: "CASCADE",
          },
          key: {
            type: Sequelize.STRING(40),
            allowNull: false,
          },
          label: {
            type: Sequelize.STRING(80),
            allowNull: false,
          },
          description: {
            type: Sequelize.STRING(255),
            allowNull: true,
          },
          portal: {
            type: Sequelize.STRING(20),
            allowNull: false,
          },
          is_system: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: true,
          },
          version: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 1,
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
        `ALTER TABLE roles
           ADD CONSTRAINT roles_portal_check CHECK (portal IN ('admin', 'teacher', 'parent')),
           ADD CONSTRAINT roles_version_check CHECK (version >= 1)`,
        { transaction },
      );
      await queryInterface.addIndex("roles", ["fk_school_id", "key"], {
        name: "uq_roles_school_key",
        unique: true,
        transaction,
      });
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("roles");
  },
};
