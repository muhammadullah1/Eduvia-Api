"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("classes", {
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
      grade: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      section: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      label: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      room: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },
      period_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 8,
      },
      monthly_tuition_fee: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.0,
      },
      capacity: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 50,
      },
      status: {
        type: Sequelize.ENUM("Active", "Archived"),
        allowNull: false,
        defaultValue: "Active",
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

    await queryInterface.addIndex("classes", ["fk_school_id", "fk_session_id", "grade", "section"], {
      unique: true,
      name: "idx_classes_school_session_grade_section_unique",
    });

    await queryInterface.addIndex("classes", ["fk_school_id", "fk_session_id"], {
      name: "idx_classes_school_session",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("classes");
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_classes_status";');
  },
};
