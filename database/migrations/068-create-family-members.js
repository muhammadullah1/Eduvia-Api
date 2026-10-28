"use strict";

/**
 * Family membership. A student may be Active in at most one family.
 */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.createTable(
        "family_members",
        {
          id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: Sequelize.INTEGER,
          },
          fk_family_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: {
              model: "families",
              key: "id",
            },
            onUpdate: "CASCADE",
            onDelete: "CASCADE",
          },
          fk_student_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: {
              model: "students",
              key: "id",
            },
            onUpdate: "CASCADE",
            onDelete: "CASCADE",
          },
          status: {
            type: Sequelize.STRING(20),
            allowNull: false,
            defaultValue: "Active",
          },
          linked_via: {
            type: Sequelize.STRING(40),
            allowNull: false,
            defaultValue: "manual",
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
        { transaction }
      );

      await queryInterface.sequelize.query(
        `ALTER TABLE family_members
           ADD CONSTRAINT family_members_status_check CHECK (status IN ('Active','Removed')),
           ADD CONSTRAINT family_members_linked_via_check CHECK (linked_via IN ('manual','shared_parent_suggestion'))`,
        { transaction }
      );
      await queryInterface.sequelize.query(
        `CREATE UNIQUE INDEX uq_family_members_family_student ON family_members (fk_family_id, fk_student_id)`,
        { transaction }
      );
      await queryInterface.sequelize.query(
        `CREATE UNIQUE INDEX uq_family_members_active_student ON family_members (fk_student_id) WHERE status = 'Active'`,
        { transaction }
      );
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("family_members");
  },
};
