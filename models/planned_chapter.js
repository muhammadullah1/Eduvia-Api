"use strict";

module.exports = (sequelize, DataTypes) => {
  const PlannedChapter = sequelize.define("planned_chapters", {
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
    sequence: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    targetDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      field: "target_date"
    },
    fkCreatedByUserId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "fk_created_by_user_id"
    },
  },
    {
      tableName: "planned_chapters",
      paranoid: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      deletedAt: "archived_at",
      underscored: true
    }
  );

  PlannedChapter.associate = (models) => {
    PlannedChapter.belongsTo(models.Classes, {
      foreignKey: "fkClassId",
      as: "class"
    });
    PlannedChapter.belongsTo(models.Subjects, {
      foreignKey: "fkSubjectId",
      as: "subject"
    });
    PlannedChapter.hasMany(models.DailyLessons, {
      foreignKey: "fkPlannedChapterId",
      as: "updates"
    });
  };

  return PlannedChapter;
};
