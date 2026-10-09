"use strict";

module.exports = (sequelize, DataTypes) => {
  const StudentStatusEvent = sequelize.define(
    "student_status_events",
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      fkSchoolId: { type: DataTypes.INTEGER, allowNull: false, field: "fk_school_id" },
      fkStudentId: { type: DataTypes.INTEGER, allowNull: false, field: "fk_student_id" },
      fromStatus: { type: DataTypes.STRING(20), allowNull: false, field: "from_status" },
      toStatus: { type: DataTypes.STRING(20), allowNull: false, field: "to_status" },
      reason: { type: DataTypes.TEXT, allowNull: false },
      effectiveOn: { type: DataTypes.DATEONLY, allowNull: false, field: "effective_on" },
      fkActorUserId: { type: DataTypes.INTEGER, allowNull: true, field: "fk_actor_user_id" },
      fkClassId: { type: DataTypes.INTEGER, allowNull: true, field: "fk_class_id" },
      fkSessionId: { type: DataTypes.INTEGER, allowNull: true, field: "fk_session_id" },
      finalResult: { type: DataTypes.STRING(255), allowNull: true, field: "final_result" },
      academicStatus: { type: DataTypes.STRING(255), allowNull: true, field: "academic_status" },
      financialStatus: { type: DataTypes.STRING(255), allowNull: true, field: "financial_status" },
    },
    {
      tableName: "student_status_events",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      underscored: true,
    },
  );

  StudentStatusEvent.associate = (models) => {
    StudentStatusEvent.belongsTo(models.Students, { foreignKey: "fkStudentId", as: "student" });
  };

  return StudentStatusEvent;
};
