"use strict";

module.exports = (sequelize, DataTypes) => {
  const MarkSheetRow = sequelize.define(
    "mark_sheet_rows",
    {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: DataTypes.INTEGER },
      fkMarkSheetId: { type: DataTypes.INTEGER, allowNull: false, field: "fk_mark_sheet_id" },
      fkStudentId: { type: DataTypes.INTEGER, allowNull: false, field: "fk_student_id" },
      score: { type: DataTypes.DECIMAL(8, 2), allowNull: true },
    },
    {
      tableName: "mark_sheet_rows",
      paranoid: false,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      underscored: true,
    },
  );

  MarkSheetRow.associate = (models) => {
    MarkSheetRow.belongsTo(models.MarkSheets, { foreignKey: "fkMarkSheetId", as: "markSheet" });
    MarkSheetRow.belongsTo(models.Students, { foreignKey: "fkStudentId", as: "student" });
  };

  return MarkSheetRow;
};
