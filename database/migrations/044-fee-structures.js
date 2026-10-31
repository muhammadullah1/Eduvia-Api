"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const { Op } = Sequelize;

    await queryInterface.createTable("fee_structures", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      fk_school_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "schools", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      fk_session_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "academic_sessions", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      fk_class_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "classes", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      fee_type: {
        type: Sequelize.STRING(20),
        allowNull: false,
      },
      frequency: {
        type: Sequelize.STRING(20),
        allowNull: false,
      },
      amount: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0,
      },
      fk_updated_by_user_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn("now"),
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn("now"),
      },
      archived_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      effective_from: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      removed_reason: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      fk_removed_by_user_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
    });

    await queryInterface.addIndex(
      "fee_structures",
      ["fk_class_id", "fee_type", { name: "effective_from", order: "DESC" }],
      { name: "idx_fee_structures_lookup" },
    );
    await queryInterface.addIndex(
      "fee_structures",
      ["fk_school_id", "fk_session_id"],
      { name: "idx_fee_structures_school_session" },
    );
    await queryInterface.addIndex(
      "fee_structures",
      ["fk_class_id", "fee_type", "effective_from"],
      {
        name: "uq_fee_structures_class_type_effective",
        unique: true,
        where: { archived_at: null },
      },
    );
    await queryInterface.addConstraint("fee_structures", {
      fields: ["amount"],
      type: "check",
      name: "fee_structures_amount_check",
      where: { amount: { [Op.gte]: 0 } },
    });
    await queryInterface.addConstraint("fee_structures", {
      fields: ["fee_type"],
      type: "check",
      name: "fee_structures_fee_type_check",
      where: {
        fee_type: ["Tuition", "Admission", "Exam", "Annual", "Promotion"],
      },
    });
    await queryInterface.addConstraint("fee_structures", {
      fields: ["frequency"],
      type: "check",
      name: "fee_structures_frequency_check",
      where: { frequency: ["Monthly", "OneTime", "Yearly"] },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("fee_structures");
  },
};
