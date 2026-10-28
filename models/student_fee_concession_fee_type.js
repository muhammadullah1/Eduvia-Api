"use strict";

const { FEE_TYPES } = require("../constants/finance");

module.exports = (sequelize, DataTypes) => {
  const StudentFeeConcessionFeeType = sequelize.define(
    "student_fee_concession_fee_types",
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER,
      },
      fkConcessionId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "fk_concession_id",
        validate: {
          isInt: true,
        },
      },
      feeType: {
        type: DataTypes.STRING(20),
        allowNull: false,
        field: "fee_type",
        validate: {
          isIn: [FEE_TYPES],
        },
      },
    },
    {
      tableName: "student_fee_concession_fee_types",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      underscored: true,
    }
  );

  StudentFeeConcessionFeeType.associate = (models) => {
    StudentFeeConcessionFeeType.belongsTo(models.StudentFeeConcessions, {
      foreignKey: "fkConcessionId",
      as: "concession",
    });
  };

  return StudentFeeConcessionFeeType;
};
