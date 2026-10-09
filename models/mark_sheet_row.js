"use strict";

module.exports = (sequelize, DataTypes) => {
  const MarkSheetRow = sequelize.define(
    "mark_sheet_rows",
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER,
      },
      fkMarkSheetId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "fk_mark_sheet_id",
      },
      fkStudentId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "fk_student_id",
      },
      obtainedMarks: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true,
        field: "obtained_marks",
      },
      isAbsent: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: "is_absent",
      },
      remarks: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
    },
    {
      tableName: "mark_sheet_rows",
      paranoid: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      deletedAt: "archived_at",
      underscored: true,
      getterMethods: {
        score() {
          return this.getDataValue("obtainedMarks");
        },
      },
      setterMethods: {
        score(val) {
          this.setDataValue("obtainedMarks", val);
        },
      },
    }
  );

  MarkSheetRow.associate = (models) => {
    MarkSheetRow.belongsTo(models.MarkSheets, {
      foreignKey: "fkMarkSheetId",
      as: "markSheet",
    });
    MarkSheetRow.belongsTo(models.Students, {
      foreignKey: "fkStudentId",
      as: "student",
    });
  };

  return MarkSheetRow;
};
