"use strict";

module.exports = (sequelize, DataTypes) => {
  const PlannedChapter = sequelize.define(
    "planned_chapters",
    {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      fkSchoolId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "fk_school_id",
      },
      fkSessionId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "fk_session_id",
      },
      fkClassId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "fk_class_id",
      },
      fkSubjectId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "fk_subject_id",
      },
      chapterNo: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "chapter_no",
      },
      title: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      plannedStartDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        field: "planned_start_date",
      },
      plannedEndDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        field: "planned_end_date",
      },
      status: {
        type: DataTypes.ENUM("Planned", "InProgress", "Completed"),
        allowNull: false,
        defaultValue: "Planned",
      },
    },
    {
      tableName: "planned_chapters",
      paranoid: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      deletedAt: "archived_at",
      underscored: true,
      getterMethods: {
        sequence() {
          return this.getDataValue("chapterNo");
        },
      },
      setterMethods: {
        sequence(val) {
          this.setDataValue("chapterNo", val);
        },
      },
    }
  );

  PlannedChapter.associate = (models) => {
    PlannedChapter.belongsTo(models.Schools, {
      foreignKey: "fkSchoolId",
      as: "school",
    });
    PlannedChapter.belongsTo(models.AcademicSessions, {
      foreignKey: "fkSessionId",
      as: "session",
    });
    PlannedChapter.belongsTo(models.Classes, {
      foreignKey: "fkClassId",
      as: "class",
    });
    PlannedChapter.belongsTo(models.Subjects, {
      foreignKey: "fkSubjectId",
      as: "subject",
    });
    PlannedChapter.hasMany(models.DailyLessons, {
      foreignKey: "fkChapterId",
      as: "lessons",
    });
  };

  return PlannedChapter;
};
