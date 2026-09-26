"use strict";

module.exports = (sequelize, DataTypes) => {
  const ApplicationDocument = sequelize.define(
    "application_documents",
    {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: DataTypes.INTEGER },
      fkApplicationId: { type: DataTypes.INTEGER, allowNull: false, field: "fk_application_id" },
      label: { type: DataTypes.STRING, allowNull: false },
      status: {
        type: DataTypes.ENUM("Pending", "Uploaded", "Verified"),
        allowNull: false,
        defaultValue: "Pending",
      },
    },
    {
      tableName: "application_documents",
      paranoid: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      deletedAt: "archived_at",
      underscored: true,
    },
  );

  ApplicationDocument.associate = (models) => {
    ApplicationDocument.belongsTo(models.Applications, {
      foreignKey: "fkApplicationId",
      as: "application",
    });
  };

  return ApplicationDocument;
};
