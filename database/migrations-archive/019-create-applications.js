"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("applications", {
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
      applicant_first_name: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      applicant_last_name: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      gender: {
        type: Sequelize.ENUM("Male", "Female", "Other"),
        allowNull: false,
      },
      date_of_birth: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      grade_applying_for: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      parent_name: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      parent_email: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      parent_phone: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM(
          "Inquiry",
          "Applied",
          "UnderReview",
          "InterviewScheduled",
          "Approved",
          "Rejected",
          "Enrolled"
        ),
        allowNull: false,
        defaultValue: "Inquiry",
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      enrolled_student_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "students",
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

    await queryInterface.addIndex("applications", ["fk_school_id", "status"], {
      name: "idx_applications_school_status",
    });

    await queryInterface.addIndex("applications", ["fk_school_id", "fk_session_id"], {
      name: "idx_applications_school_session",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("applications");
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_applications_gender";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_applications_status";');
  },
};
