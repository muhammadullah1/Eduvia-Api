"use strict";

module.exports = (sequelize, DataTypes) => {
  const DailyLesson = sequelize.define(
    "daily_lessons",
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER,
      },
      fkSchoolId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "fk_school_id",
      },
      fkClassId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "fk_class_id",
      },
      fkSubjectId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "fk_subject_id",
      },
      fkTeacherId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "fk_teacher_id",
      },
      fkChapterId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: "fk_chapter_id",
      },
      date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      topic: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      homework: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      classwork: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      reviewStatus: {
        type: DataTypes.ENUM("Submitted", "Approved", "Rejected"),
        allowNull: false,
        defaultValue: "Submitted",
        field: "review_status",
      },
      fkSubmittedByUserId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: "fk_submitted_by_user_id",
      },
      fkReviewedByUserId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: "fk_reviewed_by_user_id",
      },
      reviewedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: "reviewed_at",
      },
      reviewNote: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: "review_note",
      },
    },
    {
      tableName: "daily_lessons",
      paranoid: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      deletedAt: "archived_at",
      underscored: true,
      getterMethods: {
        title() {
          return this.getDataValue("topic");
        },
        remarks() {
          return this.getDataValue("notes");
        },
        fkPlannedChapterId() {
          return this.getDataValue("fkChapterId");
        },
      },
      setterMethods: {
        title(val) {
          this.setDataValue("topic", val);
        },
        remarks(val) {
          this.setDataValue("notes", val);
        },
        fkPlannedChapterId(val) {
          this.setDataValue("fkChapterId", val);
        },
      },
    }
  );

  DailyLesson.associate = (models) => {
    DailyLesson.belongsTo(models.Schools, {
      foreignKey: "fkSchoolId",
      as: "school",
    });
    DailyLesson.belongsTo(models.Classes, {
      foreignKey: "fkClassId",
      as: "class",
    });
    DailyLesson.belongsTo(models.Subjects, {
      foreignKey: "fkSubjectId",
      as: "subject",
    });
    DailyLesson.belongsTo(models.Teachers, {
      foreignKey: "fkTeacherId",
      as: "teacher",
    });
    DailyLesson.belongsTo(models.PlannedChapters, {
      foreignKey: "fkChapterId",
      as: "chapter",
    });
  };

  return DailyLesson;
};
