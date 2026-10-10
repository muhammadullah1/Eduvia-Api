"use strict";

module.exports = (sequelize, DataTypes) => {
  const StudentPromotion = sequelize.define(
    "student_promotions",
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      fkSchoolId: { type: DataTypes.INTEGER, allowNull: false, field: "fk_school_id" },
      fkStudentId: { type: DataTypes.INTEGER, allowNull: false, field: "fk_student_id" },
      fkFromClassId: { type: DataTypes.INTEGER, allowNull: true, field: "fk_from_class_id" },
      fkToClassId: { type: DataTypes.INTEGER, allowNull: false, field: "fk_to_class_id" },
      fkSessionId: { type: DataTypes.INTEGER, allowNull: false, field: "fk_session_id" },
      promotedOn: { type: DataTypes.DATEONLY, allowNull: false, field: "promoted_on" },
      fkActorUserId: { type: DataTypes.INTEGER, allowNull: true, field: "fk_actor_user_id" },
    },
    {
      tableName: "student_promotions",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      underscored: true,
    },
  );

  StudentPromotion.associate = (models) => {
    StudentPromotion.belongsTo(models.Students, { foreignKey: "fkStudentId", as: "student" });
    StudentPromotion.belongsTo(models.Classes, { foreignKey: "fkFromClassId", as: "fromClass" });
    StudentPromotion.belongsTo(models.Classes, { foreignKey: "fkToClassId", as: "toClass" });
    StudentPromotion.belongsTo(models.AcademicSessions, { foreignKey: "fkSessionId", as: "session" });
  };

  return StudentPromotion;
};
