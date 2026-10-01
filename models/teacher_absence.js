"use strict";

const { archivable, id, ref } = require("../utils/model_options");

/** One row per absent teacher + date + period (UR-03). */
module.exports = (sequelize, DataTypes) => {
  const TeacherAbsence = sequelize.define(
    "teacher_absences",
    {
      id: id(DataTypes),
      fkSchoolId: ref(DataTypes, "fk_school_id"),
      fkTeacherId: ref(DataTypes, "fk_teacher_id"),
      fkClassId: ref(DataTypes, "fk_class_id", true),
      fkSubjectId: ref(DataTypes, "fk_subject_id", true),
      fkTimetableSlotId: ref(DataTypes, "fk_timetable_slot_id", true),
      date: { type: DataTypes.DATEONLY, allowNull: false },
      periodIndex: { type: DataTypes.INTEGER, allowNull: false, field: "period_index" },
      status: {
        type: DataTypes.ENUM("Pending", "Covered", "Cancelled", "NoClass"),
        allowNull: false,
        defaultValue: "Pending",
      },
      fkMarkedByUserId: ref(DataTypes, "fk_marked_by_user_id", true),
      notes: { type: DataTypes.TEXT, allowNull: true },
    },
    archivable("teacher_absences"),
  );

  TeacherAbsence.associate = (models) => {
    TeacherAbsence.belongsTo(models.Schools, { foreignKey: "fkSchoolId", as: "school" });
    TeacherAbsence.belongsTo(models.Teachers, { foreignKey: "fkTeacherId", as: "teacher" });
    TeacherAbsence.belongsTo(models.Classes, { foreignKey: "fkClassId", as: "class" });
    TeacherAbsence.belongsTo(models.Subjects, { foreignKey: "fkSubjectId", as: "subject" });
    TeacherAbsence.belongsTo(models.TimetableSlots, { foreignKey: "fkTimetableSlotId", as: "slot" });
    TeacherAbsence.belongsTo(models.Users, { foreignKey: "fkMarkedByUserId", as: "markedBy" });
    TeacherAbsence.hasOne(models.SubstituteAssignments, { foreignKey: "fkAbsenceId", as: "substitution" });
  };

  return TeacherAbsence;
};
