"use strict";

module.exports = (sequelize, DataTypes) => {
  const DailyLesson = sequelize.define(
    "daily_lessons",
    {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: DataTypes.INTEGER },
      fkSchoolId: { type: DataTypes.INTEGER, allowNull: false, field: "fk_school_id" },
      fkClassId: { type: DataTypes.INTEGER, allowNull: false, field: "fk_class_id" },
      fkSubjectId: { type: DataTypes.INTEGER, allowNull: true, field: "fk_subject_id" },
      fkTeacherId: { type: DataTypes.INTEGER, allowNull: true, field: "fk_teacher_id" },
      date: { type: DataTypes.DATEONLY, allowNull: false },
      periodIndex: { type: DataTypes.INTEGER, allowNull: true, field: "period_index" },
      chapter: { type: DataTypes.STRING, allowNull: false },
      title: { type: DataTypes.STRING, allowNull: true },
      notes: { type: DataTypes.TEXT, allowNull: true },
      progress: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      status: {
        type: DataTypes.ENUM("Planned", "In progress", "Completed"),
        allowNull: false,
        defaultValue: "Planned",
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
    },
  );

  DailyLesson.associate = (models) => {
    DailyLesson.belongsTo(models.Schools, { foreignKey: "fkSchoolId", as: "school" });
    DailyLesson.belongsTo(models.Classes, { foreignKey: "fkClassId", as: "class" });
    DailyLesson.belongsTo(models.Subjects, { foreignKey: "fkSubjectId", as: "subject" });
    DailyLesson.belongsTo(models.Teachers, { foreignKey: "fkTeacherId", as: "teacher" });
  };

  return DailyLesson;
};
