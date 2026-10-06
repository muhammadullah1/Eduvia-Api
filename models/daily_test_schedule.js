"use strict";

module.exports = (sequelize, DataTypes) => {
  const DailyTestSchedule = sequelize.define("daily_test_schedules", {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true
    },
    fkSchoolId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "fk_school_id"
    },
    fkClassId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "fk_class_id"
    },
    fkSubjectId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "fk_subject_id"
    },
    weekday: {
      type: DataTypes.STRING(12),
      allowNull: false
    },
    periodIndex: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "period_index"
    },
    maxScore: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 20,
      field: "max_score"
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: "is_active"
    },
    fkCreatedByUserId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "fk_created_by_user_id"
    },
  },
    {
      tableName: "daily_test_schedules",
      paranoid: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      deletedAt: "archived_at",
      underscored: true
    }
  );

  DailyTestSchedule.associate = (models) => {
    DailyTestSchedule.belongsTo(models.Classes, {
      foreignKey: "fkClassId", as: "class"
    });
    DailyTestSchedule.belongsTo(models.Subjects, {
      foreignKey: "fkSubjectId", as: "subject"
    });
    DailyTestSchedule.hasMany(models.DailyTests, {
      foreignKey: "fkScheduleId", as: "tests"
    });
  };

  return DailyTestSchedule;
};
