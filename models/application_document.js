"use strict";

module.exports = (sequelize, DataTypes) => {
  const ApplicationDocument = sequelize.define(
    "application_documents",
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER,
      },
      fkApplicationId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "fk_application_id",
      },
      title: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      fileUrl: {
        type: DataTypes.STRING(500),
        allowNull: true,
        field: "file_url",
      },
      status: {
        type: DataTypes.ENUM("Pending", "Uploaded", "Verified", "Rejected"),
        allowNull: false,
        defaultValue: "Pending",
      },
      documentType: {
        type: DataTypes.STRING(100),
        allowNull: true,
        field: "document_type",
      },
    },
    {
      tableName: "application_documents",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      underscored: true,
      getterMethods: {
        label() {
          return this.getDataValue("title");
        },
      },
      setterMethods: {
        label(val) {
          this.setDataValue("title", val);
        },
      },
    }
  );

  ApplicationDocument.associate = (models) => {
    ApplicationDocument.belongsTo(models.Applications, {
      foreignKey: "fkApplicationId",
      as: "application",
    });
  };

  return ApplicationDocument;
};
