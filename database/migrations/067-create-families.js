"use strict";

/**
 * Explicit school families for sibling concessions.
 * Membership is verified; phone/name matching must never auto-create family links.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.createTable(
        "families",
        {
          id: { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER },
          fk_school_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: { model: "schools", key: "id" },
            onUpdate: "CASCADE",
            onDelete: "CASCADE",
          },
          display_name: { type: Sequelize.STRING(150), allowNull: false },
          fk_primary_parent_id: {
            type: Sequelize.INTEGER,
            allowNull: true,
            references: { model: "parents", key: "id" },
            onUpdate: "CASCADE",
            onDelete: "SET NULL",
          },
          verified_at: { type: Sequelize.DATE, allowNull: true },
          fk_verified_by_user_id: {
            type: Sequelize.INTEGER,
            allowNull: true,
            references: { model: "users", key: "id" },
            onUpdate: "CASCADE",
            onDelete: "SET NULL",
          },
          created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn("NOW") },
          updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn("NOW") },
          archived_at: { type: Sequelize.DATE, allowNull: true },
        },
        { transaction },
      );
      await queryInterface.sequelize.query(
        `CREATE INDEX idx_families_school ON families (fk_school_id) WHERE archived_at IS NULL`,
        { transaction },
      );
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("families");
  },
};
