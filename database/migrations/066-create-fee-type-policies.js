"use strict";

/**
 * Per-school fee-type policies: whether concessions may apply to a fee type.
 * Seeded for Tuition / Admission / Exam / Annual (all eligible by default).
 */
const { FEE_TYPES } = require("../../constants/finance");

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.createTable(
        "fee_type_policies",
        {
          id: { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER },
          fk_school_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: { model: "schools", key: "id" },
            onUpdate: "CASCADE",
            onDelete: "CASCADE",
          },
          fee_type: { type: Sequelize.STRING(20), allowNull: false },
          concession_eligible: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
          active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
          label: { type: Sequelize.STRING(100), allowNull: true },
          created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn("NOW") },
          updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn("NOW") },
          archived_at: { type: Sequelize.DATE, allowNull: true },
        },
        { transaction },
      );
      const q = (sql) => queryInterface.sequelize.query(sql, { transaction });
      await q(`CREATE UNIQUE INDEX uq_fee_type_policies_school_type ON fee_type_policies (fk_school_id, fee_type) WHERE archived_at IS NULL`);
      const types = FEE_TYPES.map((t) => `'${t}'`).join(", ");
      await q(`INSERT INTO fee_type_policies (fk_school_id, fee_type, concession_eligible, active, label, created_at, updated_at)
        SELECT s.id, t.fee_type, TRUE, TRUE, t.fee_type, NOW(), NOW()
        FROM schools s
        CROSS JOIN (SELECT unnest(ARRAY[${types}]) AS fee_type) t
        WHERE s.archived_at IS NULL`);
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("fee_type_policies");
  },
};
