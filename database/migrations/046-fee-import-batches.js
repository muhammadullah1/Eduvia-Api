"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const { Op } = Sequelize;

    await queryInterface.createTable("fee_import_batches", {
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
      file_name: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      file_hash: {
        type: Sequelize.STRING(64),
        allowNull: true,
      },
      status: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: "Validated",
      },
      total_rows: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      valid_rows: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      error_rows: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      duplicate_rows: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      imported_rows: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      total_amount: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0,
      },
      fk_uploaded_by_user_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      committed_at: {
        type: Sequelize.DATE,
        allowNull: true,
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
      commit_key: {
        type: Sequelize.STRING(120),
        allowNull: true,
      },
    });

    await queryInterface.addIndex(
      "fee_import_batches",
      ["fk_school_id", "file_hash"],
      { name: "idx_fee_import_batches_file_hash" },
    );
    await queryInterface.addIndex(
      "fee_import_batches",
      ["fk_school_id", "created_at"],
      { name: "idx_fee_import_batches_school" },
    );
    await queryInterface.addIndex(
      "fee_import_batches",
      ["fk_school_id", "commit_key"],
      {
        name: "uq_fee_import_batches_commit_key",
        unique: true,
        where: { commit_key: { [Op.ne]: null } },
      },
    );
    await queryInterface.addConstraint("fee_import_batches", {
      fields: [
        "total_rows",
        "valid_rows",
        "error_rows",
        "duplicate_rows",
        "imported_rows",
      ],
      type: "check",
      name: "fee_import_batches_counts_check",
      where: {
        total_rows: { [Op.gte]: 0 },
        valid_rows: { [Op.gte]: 0 },
        error_rows: { [Op.gte]: 0 },
        duplicate_rows: { [Op.gte]: 0 },
        imported_rows: { [Op.gte]: 0 },
      },
    });
    await queryInterface.addConstraint("fee_import_batches", {
      fields: ["status"],
      type: "check",
      name: "fee_import_batches_status_check",
      where: {
        status: ["Validated", "Committing", "Committed", "Discarded", "Failed"],
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("fee_import_batches");
  },
};
