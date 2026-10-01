"use strict";

const { archivable, id, ref } = require("../utils/model_options");

module.exports = (sequelize, DataTypes) => {
  const SubstituteAssignment = sequelize.define(
    "substitute_assignments",
    {
      id: id(DataTypes),
      fkSchoolId: ref(DataTypes, "fk_school_id"),
      fkAbsenceId: ref(DataTypes, "fk_absence_id"),
      fkTimetableSlotId: ref(DataTypes, "fk_timetable_slot_id", true),
      date: { type: DataTypes.DATEONLY, allowNull: false },
      periodIndex: { type: DataTypes.INTEGER, allowNull: false, field: "period_index" },
      fkClassId: ref(DataTypes, "fk_class_id"),
      fkSubjectId: ref(DataTypes, "fk_subject_id", true),
      fkOriginalTeacherId: ref(DataTypes, "fk_original_teacher_id"),
      fkSubstituteTeacherId: ref(DataTypes, "fk_substitute_teacher_id"),
      fkAuthorizedByUserId: ref(DataTypes, "fk_authorized_by_user_id", true),
      notes: { type: DataTypes.TEXT, allowNull: true },
    },
    archivable("substitute_assignments"),
  );

  SubstituteAssignment.associate = (models) => {
    SubstituteAssignment.belongsTo(models.TeacherAbsences, { foreignKey: "fkAbsenceId", as: "absence" });
    SubstituteAssignment.belongsTo(models.TimetableSlots, { foreignKey: "fkTimetableSlotId", as: "slot" });
    SubstituteAssignment.belongsTo(models.Classes, { foreignKey: "fkClassId", as: "class" });
    SubstituteAssignment.belongsTo(models.Subjects, { foreignKey: "fkSubjectId", as: "subject" });
    SubstituteAssignment.belongsTo(models.Teachers, { foreignKey: "fkOriginalTeacherId", as: "originalTeacher" });
    SubstituteAssignment.belongsTo(models.Teachers, { foreignKey: "fkSubstituteTeacherId", as: "substituteTeacher" });
    SubstituteAssignment.belongsTo(models.Users, { foreignKey: "fkAuthorizedByUserId", as: "authorizedBy" });
  };

  return SubstituteAssignment;
};
