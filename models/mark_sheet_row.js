"use strict";

module.exports = (sequelize, DataTypes) => {
  const MarkSheetRow = sequelize.define(
    "mark_sheet_rows",
    {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: DataTypes.INTEGER },
      fkMarkSheetId: { type: DataTypes.INTEGER, allowNull: false, field: "fk_mark_sheet_id" },
      fkStudentId: { type: DataTypes.INTEGER, allowNull: false, field: "fk_student_id" },
      score: { type: DataTypes.DECIMAL(8, 2), allowNull: true },
      blockedByFee: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: "blocked_by_fee",
      },
      manualOverride: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: "manual_override",
      },
      overrideReason: { type: DataTypes.TEXT, allowNull: true, field: "override_reason" },
      overrideByUserId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: "override_by_user_id",
      },
      visibleToParent: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: "visible_to_parent",
      },
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
    MarkSheetRow.belongsTo(models.Users, { foreignKey: "overrideByUserId", as: "overrideBy" });
  };

  return MarkSheetRow;
};
