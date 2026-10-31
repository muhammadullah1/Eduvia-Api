"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const { Op } = Sequelize;

    await queryInterface.createTable("school_concession_reasons", {
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
      requires_family: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
    });

    await queryInterface.addIndex(
      "school_concession_reasons",
      ["fk_school_id", "active", "sort_order"],
      { name: "idx_school_concession_reasons_school_active" },
    );
    await queryInterface.addIndex(
      "school_concession_reasons",
      ["fk_school_id", Sequelize.fn("lower", Sequelize.col("label"))],
      {
        name: "uq_school_concession_reasons_school_label",
        unique: true,
        where: { archived_at: null },
      },
    );
    await queryInterface.addConstraint("school_concession_reasons", {
      fields: ["default_mode"],
      type: "check",
      name: "school_concession_reasons_default_mode_check",
      where: {
        [Op.or]: [
          { default_mode: null },
          {
            default_mode: [
              "percent",
              "fixed_discount",
              "fixed_payable",
              "waiver",
            ],
          },
        ],
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("school_concession_reasons");
  },
};
