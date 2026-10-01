"use strict";

const { archivable, id, ref } = require("../utils/model_options");

module.exports = (sequelize, DataTypes) => {
  const PlannedChapter = sequelize.define(
    "planned_chapters",
    {
      id: id(DataTypes),
      fkSchoolId: ref(DataTypes, "fk_school_id"),
      fkClassId: ref(DataTypes, "fk_class_id"),
      fkSubjectId: ref(DataTypes, "fk_subject_id"),
      sequence: { type: DataTypes.INTEGER, allowNull: false },
      title: { type: DataTypes.STRING, allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: true },
      targetDate: { type: DataTypes.DATEONLY, allowNull: true, field: "target_date" },
      fkCreatedByUserId: ref(DataTypes, "fk_created_by_user_id", true),
    },
    archivable("planned_chapters"),
  );

  PlannedChapter.associate = (models) => {
    PlannedChapter.belongsTo(models.Classes, { foreignKey: "fkClassId", as: "class" });
    PlannedChapter.belongsTo(models.Subjects, { foreignKey: "fkSubjectId", as: "subject" });
    PlannedChapter.hasMany(models.DailyLessons, { foreignKey: "fkPlannedChapterId", as: "updates" });
  };

  return PlannedChapter;
};
