"use strict";

/**
 * Append-only status history for student fee concessions.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.createTable(
        "student_fee_concession_events",
        {
          id: { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER },
          fk_concession_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: { model: "student_fee_concessions", key: "id" },
            onUpdate: "CASCADE",
            onDelete: "CASCADE",
          },
          event_type: { type: Sequelize.STRING(40), allowNull: false },
          from_status: { type: Sequelize.STRING(30), allowNull: true },
          to_status: { type: Sequelize.STRING(30), allowNull: true },
          fk_actor_user_id: {
            type: Sequelize.INTEGER,
            allowNull: true,
            references: { model: "users", key: "id" },
            onUpdate: "CASCADE",
            onDelete: "SET NULL",
          },
          payload: { type: Sequelize.JSONB, allowNull: true },
          created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn("NOW") },
        },
        { transaction },
      );
      await queryInterface.sequelize.query(
        `CREATE INDEX idx_concession_events_concession ON student_fee_concession_events (fk_concession_id, created_at DESC)`,
        { transaction },
      );
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("student_fee_concession_events");
  },
};
