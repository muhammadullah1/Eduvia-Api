"use strict";

/** A manager's reminder that a class's attendance for a day is still pending. */
module.exports = (sequelize, DataTypes) => {
  const AttendanceReminder = sequelize.define(
    "attendance_reminders",
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      fkSchoolId: { type: DataTypes.INTEGER, allowNull: false, field: "fk_school_id" },
      fkClassId: { type: DataTypes.INTEGER, allowNull: false, field: "fk_class_id" },
      date: { type: DataTypes.DATEONLY, allowNull: false },
      fkTeacherUserId: { type: DataTypes.INTEGER, allowNull: true, field: "fk_teacher_user_id" },
      fkSentByUserId: { type: DataTypes.INTEGER, allowNull: true, field: "fk_sent_by_user_id" },
      readAt: { type: DataTypes.DATE, allowNull: true, field: "read_at" },
    },
    { tableName: "attendance_reminders", timestamps: true, createdAt: "created_at", updatedAt: "updated_at", underscored: true },
  );
  AttendanceReminder.associate = (models) => {
    AttendanceReminder.belongsTo(models.Classes, { foreignKey: "fkClassId", as: "class" });
    AttendanceReminder.belongsTo(models.Users, { foreignKey: "fkSentByUserId", as: "sentBy" });
  };
  return AttendanceReminder;
};
