"use strict";

module.exports = (sequelize, DataTypes) => {
  const MarkSheet = sequelize.define(
    "mark_sheets",
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
      },
      fkExamId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "fk_exam_id",
      },
      fkTeacherId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: "fk_teacher_id",
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
      totalMarks: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 100.0,
        field: "total_marks",
      },
      passingMarks: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 40.0,
        field: "passing_marks",
      },
      status: {
        type: DataTypes.ENUM("Draft", "Submitted", "Verified", "Published"),
        allowNull: false,
        defaultValue: "Draft",
      },
      fkSubmittedByUserId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: "fk_submitted_by_user_id",
      },
      fkApprovedByUserId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: "fk_approved_by_user_id",
      },
      publishedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: "published_at",
      },
      fkPublishedByUserId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: "fk_published_by_user_id",
      },
    },
    {
      tableName: "mark_sheets",
      paranoid: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      deletedAt: "archived_at",
      underscored: true,
      getterMethods: {
        maxScore() {
          return this.getDataValue("totalMarks");
        },
        passPercent() {
          return this.getDataValue("passingMarks");
        },
      },
      setterMethods: {
        maxScore(val) {
          this.setDataValue("totalMarks", val);
        },
        passPercent(val) {
          this.setDataValue("passingMarks", val);
        },
      },
    }
  );

  MarkSheet.associate = (models) => {
    MarkSheet.belongsTo(models.Exams, {
      foreignKey: "fkExamId",
      as: "exam",
    });
    MarkSheet.belongsTo(models.Classes, {
      foreignKey: "fkClassId",
      as: "class",
    });
    MarkSheet.belongsTo(models.Subjects, {
      foreignKey: "fkSubjectId",
      as: "subject",
    });
    MarkSheet.belongsTo(models.Users, {
      foreignKey: "fkSubmittedByUserId",
      as: "submittedBy",
    });
    MarkSheet.belongsTo(models.Users, {
      foreignKey: "fkApprovedByUserId",
      as: "approvedBy",
    });
    MarkSheet.hasMany(models.MarkSheetRows, {
      foreignKey: "fkMarkSheetId",
      as: "rows",
    });
  };

  return MarkSheet;
};
