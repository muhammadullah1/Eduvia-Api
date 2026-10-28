"use strict";

const { FEE_TYPES } = require("../constants/finance");

module.exports = (sequelize, DataTypes) => {
  const FeeTypePolicy = sequelize.define(
    "fee_type_policies",
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER,
      },
      fkSchoolId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "fk_school_id",
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
      concessionEligible: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        field: "concession_eligible",
      },
      active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      label: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
    },
    {
      tableName: "fee_type_policies",
      paranoid: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      deletedAt: "archived_at",
      underscored: true,
    }
  );

  FeeTypePolicy.associate = (models) => {
    FeeTypePolicy.belongsTo(models.Schools, {
      foreignKey: "fkSchoolId",
      as: "school",
    });
  };

  return FeeTypePolicy;
};
