"use strict";

/** One permanent change to a saved attendance mark (append-only). */
module.exports = (sequelize, DataTypes) => {
  const AttendanceChange = sequelize.define(
    "attendance_changes",
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      fkSchoolId: { type: DataTypes.INTEGER, allowNull: false, field: "fk_school_id" },
      fkAttendanceId: { type: DataTypes.INTEGER, allowNull: true, field: "fk_attendance_id" },
      fkStudentId: { type: DataTypes.INTEGER, allowNull: false, field: "fk_student_id" },
      fkClassId: { type: DataTypes.INTEGER, allowNull: true, field: "fk_class_id" },
      date: { type: DataTypes.DATEONLY, allowNull: false },
      fromStatus: { type: DataTypes.STRING(20), allowNull: true, field: "from_status" },
      toStatus: { type: DataTypes.STRING(20), allowNull: false, field: "to_status" },
      reason: { type: DataTypes.TEXT, allowNull: true },
      source: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "review" },
      fkActorUserId: { type: DataTypes.INTEGER, allowNull: true, field: "fk_actor_user_id" },
    },
    { tableName: "attendance_changes", timestamps: true, createdAt: "created_at", updatedAt: "updated_at", underscored: true },
  );
  AttendanceChange.associate = (models) => {
    AttendanceChange.belongsTo(models.Students, { foreignKey: "fkStudentId", as: "student" });
    AttendanceChange.belongsTo(models.Classes, { foreignKey: "fkClassId", as: "class" });
    AttendanceChange.belongsTo(models.Users, { foreignKey: "fkActorUserId", as: "actor" });
  };
  return AttendanceChange;
};
