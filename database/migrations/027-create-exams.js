"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("exams", {
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
        onDelete: "RESTRICT",
      },
      fk_session_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "academic_sessions",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      name: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      start_date: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      end_date: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      status: {
        type: Sequelize.ENUM("Draft", "Published", "Archived"),
        allowNull: false,
        defaultValue: "Draft",
      },
      required_fee_month: {
        type: Sequelize.STRING(7),
        allowNull: true,
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

    await queryInterface.addIndex("exams", ["fk_school_id", "fk_session_id", "name"], {
      unique: true,
      name: "idx_exams_school_session_name_unique",
    });

    await queryInterface.addIndex("exams", ["fk_school_id", "fk_session_id"], {
      name: "idx_exams_school_session",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("exams");
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_exams_status";');
  },
};
