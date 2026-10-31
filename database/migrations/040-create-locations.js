"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const { Op } = Sequelize;

    await queryInterface.createTable("locations", {
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
      fk_session_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "academic_sessions", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      name: {
        type: Sequelize.STRING(120),
        allowNull: false,
      },
      location_code: {
        type: Sequelize.STRING(40),
        allowNull: true,
      },
      location_type: {
        type: Sequelize.STRING(40),
        allowNull: true,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      capacity: {
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
      archived_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
    });

    await queryInterface.addIndex(
      "locations",
      [
        "fk_school_id",
        "fk_session_id",
        Sequelize.fn("lower", Sequelize.col("location_code")),
      ],
      {
        name: "idx_locations_session_code_active_unique",
        unique: true,
        where: {
          [Op.and]: [
            { archived_at: null },
            { location_code: { [Op.ne]: null } },
            Sequelize.where(
              Sequelize.fn("btrim", Sequelize.col("location_code")),
              Op.ne,
              "",
            ),
          ],
        },
      },
    );
    await queryInterface.addIndex(
      "locations",
      [
        "fk_school_id",
        "fk_session_id",
        Sequelize.fn("lower", Sequelize.col("name")),
      ],
      {
        name: "idx_locations_session_name_active_unique",
        unique: true,
        where: { archived_at: null },
      },
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable("locations");
  },
};
