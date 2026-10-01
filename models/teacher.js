"use strict";

module.exports = (sequelize, DataTypes) => {
  const Teacher = sequelize.define(
    "teachers",
    {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: DataTypes.INTEGER },
      fkUserId: { type: DataTypes.INTEGER, allowNull: false, unique: true, field: "fk_user_id" },
      fkSchoolId: { type: DataTypes.INTEGER, allowNull: false, field: "fk_school_id" },
      employeeCode: { type: DataTypes.STRING, allowNull: true, field: "employee_code" },
      /** The one active subject (UR-02). History lives in teacher_subject_assignments. */
      fkSubjectId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "fk_subject_id",
      },
    },
    {
      tableName: "teachers",
      paranoid: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      deletedAt: "archived_at",
      underscored: true,
    },
  );

  Teacher.associate = (models) => {
    Teacher.belongsTo(models.Users, { foreignKey: "fkUserId", as: "user" });
    Teacher.belongsTo(models.Schools, { foreignKey: "fkSchoolId", as: "school" });
    Teacher.belongsTo(models.Subjects, { foreignKey: "fkSubjectId", as: "subject" });
    Teacher.hasMany(models.TeacherSubjectAssignments, { foreignKey: "fkTeacherId", as: "subjectHistory" });
    Teacher.belongsToMany(models.Classes, {
      through: models.TeacherClasses,
      foreignKey: "fkTeacherId",
      otherKey: "fkClassId",
      as: "classes",
    });
    Teacher.hasMany(models.TeacherAbsences, { foreignKey: "fkTeacherId", as: "absences" });
  };

  return Teacher;
};
