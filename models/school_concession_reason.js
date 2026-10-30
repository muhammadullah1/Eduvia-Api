"use strict";

module.exports = (sequelize, DataTypes) => {
  const SchoolConcessionReason = sequelize.define(
    "school_concession_reasons",
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
      label: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      defaultMode: {
        type: DataTypes.STRING(30),
        allowNull: true,
        field: "default_mode",
        validate: {
          isIn: [["percent", "fixed_discount", "waiver"]],
        },
      },
      defaultValue: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true,
        field: "default_value",
      },
      sortOrder: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 100,
        field: "sort_order",
        validate: {
          isInt: true,
        },
      },
      active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    },
    {
      tableName: "school_concession_reasons",
      paranoid: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      deletedAt: "archived_at",
      underscored: true,
    }
  );

  SchoolConcessionReason.associate = (models) => {
    SchoolConcessionReason.belongsTo(models.Schools, {
      foreignKey: "fkSchoolId",
      as: "school",
    });
    SchoolConcessionReason.hasMany(models.StudentFeeConcessions, {
      foreignKey: "fkReasonId",
      as: "concessions",
    });
  };

  return SchoolConcessionReason;
};
