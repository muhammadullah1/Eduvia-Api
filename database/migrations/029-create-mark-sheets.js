"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("mark_sheets", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      fk_exam_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "exams",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
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
      total_marks: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 100.0,
      },
      passing_marks: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 40.0,
      },
      status: {
        type: Sequelize.ENUM("Draft", "Submitted", "Approved", "Published"),
        allowNull: false,
        defaultValue: "Draft",
      },
      fk_submitted_by_user_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      fk_approved_by_user_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
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

    await queryInterface.addIndex("mark_sheets", ["fk_exam_id", "fk_class_id", "fk_subject_id"], {
      unique: true,
      name: "idx_mark_sheets_exam_class_subject_unique",
    });

    await queryInterface.addIndex("mark_sheets", ["fk_class_id", "fk_subject_id"], {
      name: "idx_mark_sheets_class_subject",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("mark_sheets");
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_mark_sheets_status";');
  },
};
