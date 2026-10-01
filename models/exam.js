"use strict";

const { archivable, id, ref } = require("../utils/model_options");

/** An exam for a class; each subject is a mark sheet (UR-07). */
module.exports = (sequelize, DataTypes) => {
  const Exam = sequelize.define(
    "exams",
    {
      id: id(DataTypes),
      fkSchoolId: ref(DataTypes, "fk_school_id"),
      fkSessionId: ref(DataTypes, "fk_session_id", true),
      fkClassId: ref(DataTypes, "fk_class_id"),
      name: { type: DataTypes.STRING, allowNull: false },
      feeMonth: { type: DataTypes.STRING(7), allowNull: true, field: "fee_month" },
    },
    archivable("exams"),
  );

  Exam.associate = (models) => {
    Exam.belongsTo(models.Classes, { foreignKey: "fkClassId", as: "class" });
    Exam.belongsTo(models.AcademicSessions, { foreignKey: "fkSessionId", as: "session" });
    Exam.hasMany(models.MarkSheets, { foreignKey: "fkExamId", as: "sheets" });
    Exam.hasMany(models.ResultVisibilityOverrides, { foreignKey: "fkExamId", as: "overrides" });
  };

  return Exam;
};
