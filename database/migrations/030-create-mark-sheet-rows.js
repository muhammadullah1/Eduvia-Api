"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("mark_sheet_rows", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      fk_mark_sheet_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "mark_sheets",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      fk_student_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "students",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      obtained_marks: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: true,
      },
      is_absent: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      remarks: {
        type: Sequelize.STRING(255),
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

    await queryInterface.addIndex("mark_sheet_rows", ["fk_mark_sheet_id", "fk_student_id"], {
      unique: true,
      name: "idx_mark_sheet_rows_sheet_student_unique",
    });

    await queryInterface.addIndex("mark_sheet_rows", ["fk_student_id"], {
      name: "idx_mark_sheet_rows_student",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("mark_sheet_rows");
  },
};
