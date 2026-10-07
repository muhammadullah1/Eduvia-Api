"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("timetable_slots", {
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
      fk_class_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "classes",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      fk_teacher_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "teachers",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      fk_subject_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "subjects",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      day_of_week: {
        type: Sequelize.ENUM("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"),
        allowNull: false,
      },
      period_index: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      start_time: {
        type: Sequelize.TIME,
        allowNull: true,
      },
      end_time: {
        type: Sequelize.TIME,
        allowNull: true,
      },
      room: {
        type: Sequelize.STRING(50),
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

    await queryInterface.addIndex("timetable_slots", ["fk_class_id", "day_of_week", "period_index"], {
      unique: true,
      name: "idx_timetable_class_day_period_unique",
    });

    await queryInterface.addIndex("timetable_slots", ["fk_school_id", "fk_teacher_id", "day_of_week", "period_index"], {
      unique: true,
      name: "idx_timetable_teacher_day_period_unique",
    });

    await queryInterface.addIndex("timetable_slots", ["fk_school_id", "fk_class_id"], {
      name: "idx_timetable_slots_school_class",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("timetable_slots");
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_timetable_slots_day_of_week";');
  },
};
