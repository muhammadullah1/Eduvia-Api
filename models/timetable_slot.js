"use strict";

module.exports = (sequelize, DataTypes) => {
  const TimetableSlot = sequelize.define(
    "timetable_slots",
    {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: DataTypes.INTEGER },
      fkSchoolId: { type: DataTypes.INTEGER, allowNull: false, field: "fk_school_id" },
      fkClassId: { type: DataTypes.INTEGER, allowNull: false, field: "fk_class_id" },
      day: { type: DataTypes.STRING, allowNull: false },
      time: { type: DataTypes.STRING, allowNull: false },
      periodIndex: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
        field: "period_index",
      },
      subject: { type: DataTypes.STRING, allowNull: false },
      fkSubjectId: { type: DataTypes.INTEGER, allowNull: true, field: "fk_subject_id" },
      teacher: { type: DataTypes.STRING, allowNull: true },
      fkTeacherId: { type: DataTypes.INTEGER, allowNull: true, field: "fk_teacher_id" },
      room: { type: DataTypes.STRING, allowNull: true },
    },
    {
      tableName: "timetable_slots",
      paranoid: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      deletedAt: "archived_at",
      underscored: true,
    },
  );

  TimetableSlot.associate = (models) => {
    TimetableSlot.belongsTo(models.Schools, { foreignKey: "fkSchoolId", as: "school" });
    TimetableSlot.belongsTo(models.Classes, { foreignKey: "fkClassId", as: "class" });
    TimetableSlot.belongsTo(models.Teachers, { foreignKey: "fkTeacherId", as: "teacherRef" });
    TimetableSlot.belongsTo(models.Subjects, { foreignKey: "fkSubjectId", as: "subjectRef" });
  };

  return TimetableSlot;
};
