"use strict";

module.exports = (sequelize, DataTypes) => {
  const FeePayment = sequelize.define(
    "fee_payments",
    {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: DataTypes.INTEGER },
      fkSchoolId: { type: DataTypes.INTEGER, allowNull: false, field: "fk_school_id" },
      ref: { type: DataTypes.STRING, allowNull: false, unique: true },
      fkStudentId: { type: DataTypes.INTEGER, allowNull: false, field: "fk_student_id" },
      period: { type: DataTypes.STRING, allowNull: false },
      type: { type: DataTypes.STRING, allowNull: false },
      amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
      method: { type: DataTypes.STRING, allowNull: true },
      status: {
        type: DataTypes.ENUM("Paid", "Pending"),
        allowNull: false,
        defaultValue: "Pending",
      },
      paidOn: { type: DataTypes.DATEONLY, allowNull: true, field: "paid_on" },
      dueDate: { type: DataTypes.DATEONLY, allowNull: true, field: "due_date" },
      notes: { type: DataTypes.TEXT, allowNull: true },
    },
    {
      tableName: "fee_payments",
      paranoid: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      deletedAt: "archived_at",
      underscored: true,
    },
  );

  FeePayment.associate = (models) => {
    FeePayment.belongsTo(models.Schools, { foreignKey: "fkSchoolId", as: "school" });
    FeePayment.belongsTo(models.Students, { foreignKey: "fkStudentId", as: "student" });
  };

  return FeePayment;
};
