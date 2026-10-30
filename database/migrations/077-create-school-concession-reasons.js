"use strict";

/**
 * Per-school concession reasons (Sibling, Staff child, Merit, …) with optional
 * default mode/value used when assigning a concession on a student.
 */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.createTable(
        "school_concession_reasons",
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
          label: {
            type: Sequelize.STRING(100),
            allowNull: false,
          },
          default_mode: {
            type: Sequelize.STRING(30),
            allowNull: true,
          },
          default_value: {
            type: Sequelize.DECIMAL(12, 2),
            allowNull: true,
          },
          sort_order: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 100,
          },
          active: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: true,
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
          archived_at: {
            type: Sequelize.DATE,
            allowNull: true,
          },
        },
        { transaction },
      );

      await queryInterface.sequelize.query(
        `
        ALTER TABLE school_concession_reasons
          ADD CONSTRAINT school_concession_reasons_default_mode_check
          CHECK (
            default_mode IS NULL
            OR default_mode IN ('percent', 'fixed_discount', 'waiver')
          )
        `,
        { transaction },
      );

      await queryInterface.sequelize.query(

        `
        CREATE UNIQUE INDEX uq_school_concession_reasons_school_label
          ON school_concession_reasons (fk_school_id, lower(label))
          WHERE archived_at IS NULL
        `,
        { transaction },
      );

      await queryInterface.addIndex(
        "school_concession_reasons",
        ["fk_school_id", "active", "sort_order"],
        {
          name: "idx_school_concession_reasons_school_active",
          transaction,
        },
      );
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("school_concession_reasons");
  },
};
