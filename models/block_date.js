"use strict";

module.exports = (sequelize, DataTypes) => {
  const BlockDate = sequelize.define("block_dates", {
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
    name: {
      type: DataTypes.STRING(120),
      allowNull: false,
    },
    dateType: {
      type: DataTypes.ENUM("single", "multiple"),
      allowNull: false,
      defaultValue: "single",
      field: "date_type",
    },
    startDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: "start_date",
    },
    endDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: "end_date",
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
    {
      tableName: "block_dates",
      paranoid: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      deletedAt: "archived_at",
      underscored: true,
    },
  );

  BlockDate.associate = (models) => {
    BlockDate.belongsTo(models.Schools, {
      foreignKey: "fkSchoolId",
      as: "school",
    });
  };

  return BlockDate;
};
