"use strict";

module.exports = (sequelize, DataTypes) => {
  const SchoolSetting = sequelize.define(
    "school_settings",
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
        unique: true,
        field: "fk_school_id",
      },
      admissionNumberPrefix: {
        type: DataTypes.STRING(20),
        allowNull: true,
        defaultValue: "CLS",
        field: "admission_number_prefix",
      },
      admissionNumberDigits: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 4,
        field: "admission_number_digits",
      },
      academicYearStartMonth: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 4,
        field: "academic_year_start_month",
      },
      currency: {
        type: DataTypes.STRING(10),
        allowNull: true,
        defaultValue: "PKR",
      },
      tuitionFeeDueDay: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 10,
        field: "tuition_fee_due_day",
      },
      lateFeeFineAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0.0,
        field: "late_fee_fine_amount",
      },
      lateFeeGraceDays: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 5,
        field: "late_fee_grace_days",
      },
      timezone: {
        type: DataTypes.STRING(50),
        allowNull: true,
        defaultValue: "Asia/Karachi",
      },
    },
    {
      tableName: "school_settings",
      paranoid: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      deletedAt: "archived_at",
      underscored: true,
    }
  );

  SchoolSetting.associate = (models) => {
    SchoolSetting.belongsTo(models.Schools, {
      foreignKey: "fkSchoolId",
      as: "school",
    });
  };

  return SchoolSetting;
};
