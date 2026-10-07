"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("substitute_assignments", {
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
      fk_absence_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "teacher_absences",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      fk_timetable_slot_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "timetable_slots",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      fk_substitute_teacher_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "teachers",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      period_index: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM("Assigned", "Completed", "Cancelled"),
        allowNull: false,
        defaultValue: "Assigned",
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

    await queryInterface.addIndex("substitute_assignments", ["fk_substitute_teacher_id", "date", "period_index"], {
      unique: true,
      name: "idx_substitute_teacher_date_period_unique",
    });

    await queryInterface.addIndex("substitute_assignments", ["fk_school_id", "date"], {
      name: "idx_substitute_assignments_school_date",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("substitute_assignments");
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_substitute_assignments_status";');
  },
};
