"use strict";

module.exports = (sequelize, DataTypes) => {
  const MarkSheet = sequelize.define(
    "mark_sheets",
    {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: DataTypes.INTEGER },
      fkSchoolId: { type: DataTypes.INTEGER, allowNull: false, field: "fk_school_id" },
      examName: { type: DataTypes.STRING, allowNull: false, field: "exam_name" },
      fkClassId: { type: DataTypes.INTEGER, allowNull: false, field: "fk_class_id" },
      fkSubjectId: { type: DataTypes.INTEGER, allowNull: true, field: "fk_subject_id" },
      subject: { type: DataTypes.STRING, allowNull: false },
      status: {
        type: DataTypes.ENUM("Draft", "Submitted", "Verified", "Published"),
        allowNull: false,
        defaultValue: "Draft",
      },
      maxScore: {
        type: DataTypes.DECIMAL(8, 2),
        allowNull: false,
        defaultValue: 100,
        field: "max_score",
      },
      feePeriod: { type: DataTypes.STRING, allowNull: true, field: "fee_period" },
      passPercent: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 40,
        field: "pass_percent",
      },
    },
    {
      tableName: "mark_sheets",
      paranoid: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      deletedAt: "archived_at",
      underscored: true,
    },
  );

  MarkSheet.associate = (models) => {
    MarkSheet.belongsTo(models.Schools, { foreignKey: "fkSchoolId", as: "school" });
    MarkSheet.belongsTo(models.Classes, { foreignKey: "fkClassId", as: "class" });
    MarkSheet.belongsTo(models.Subjects, { foreignKey: "fkSubjectId", as: "subjectRef" });
    MarkSheet.hasMany(models.MarkSheetRows, { foreignKey: "fkMarkSheetId", as: "rows" });
  };

  return MarkSheet;
};
