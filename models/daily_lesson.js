"use strict";

const { archivable, id, ref } = require("../utils/model_options");

/** Teacher's daily update against a planned chapter (UR-04). */
module.exports = (sequelize, DataTypes) => {
  const DailyLesson = sequelize.define(
    "daily_lessons",
    {
      id: id(DataTypes),
      fkSchoolId: ref(DataTypes, "fk_school_id"),
      fkClassId: ref(DataTypes, "fk_class_id"),
      fkSubjectId: ref(DataTypes, "fk_subject_id", true),
      fkTeacherId: ref(DataTypes, "fk_teacher_id", true),
      fkPlannedChapterId: ref(DataTypes, "fk_planned_chapter_id", true),
      date: { type: DataTypes.DATEONLY, allowNull: false },
      periodIndex: { type: DataTypes.INTEGER, allowNull: true, field: "period_index" },
      chapter: { type: DataTypes.STRING, allowNull: false },
      title: { type: DataTypes.STRING, allowNull: true },
      classwork: { type: DataTypes.TEXT, allowNull: true },
      homework: { type: DataTypes.TEXT, allowNull: true },
      remarks: { type: DataTypes.TEXT, allowNull: true },
      progress: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      status: {
        type: DataTypes.ENUM("Planned", "In progress", "Completed"),
        allowNull: false,
        defaultValue: "Planned",
      },
      reviewStatus: {
        type: DataTypes.ENUM("Submitted", "Approved", "Rejected"),
        allowNull: false,
        defaultValue: "Submitted",
        field: "review_status",
      },
      fkSubmittedByUserId: ref(DataTypes, "fk_submitted_by_user_id", true),
      fkReviewedByUserId: ref(DataTypes, "fk_reviewed_by_user_id", true),
      reviewedAt: { type: DataTypes.DATE, allowNull: true, field: "reviewed_at" },
      reviewNote: { type: DataTypes.TEXT, allowNull: true, field: "review_note" },
    },
    archivable("daily_lessons"),
  );

  DailyLesson.associate = (models) => {
    DailyLesson.belongsTo(models.Schools, { foreignKey: "fkSchoolId", as: "school" });
    DailyLesson.belongsTo(models.Classes, { foreignKey: "fkClassId", as: "class" });
    DailyLesson.belongsTo(models.Subjects, { foreignKey: "fkSubjectId", as: "subject" });
    DailyLesson.belongsTo(models.Teachers, { foreignKey: "fkTeacherId", as: "teacher" });
    DailyLesson.belongsTo(models.PlannedChapters, { foreignKey: "fkPlannedChapterId", as: "plannedChapter" });
  };

  return DailyLesson;
};
