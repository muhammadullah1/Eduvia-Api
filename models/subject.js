"use strict";

module.exports = (sequelize, DataTypes) => {
  const Subject = sequelize.define(
    "subjects",
    {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: DataTypes.INTEGER },
      fkSchoolId: { type: DataTypes.INTEGER, allowNull: false, field: "fk_school_id" },
      name: { type: DataTypes.STRING, allowNull: false },
      code: { type: DataTypes.STRING, allowNull: false },
    },
    {
      tableName: "subjects",
      paranoid: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      deletedAt: "archived_at",
      underscored: true,
    },
  );

  Subject.associate = (models) => {
    Subject.belongsTo(models.Schools, { foreignKey: "fkSchoolId", as: "school" });
    Subject.belongsToMany(models.Teachers, {
      through: models.TeacherSubjects,
      foreignKey: "fkSubjectId",
      otherKey: "fkTeacherId",
      as: "teachers",
    });
  };

  return Subject;
};
