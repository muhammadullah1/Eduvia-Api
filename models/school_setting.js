"use strict";

const { archivable, id, ref } = require("../utils/model_options");

module.exports = (sequelize, DataTypes) => {
  const SchoolSetting = sequelize.define(
    "school_settings",
    {
      id: id(DataTypes),
      fkSchoolId: ref(DataTypes, "fk_school_id"),
      key: { type: DataTypes.STRING(64), allowNull: false },
      value: { type: DataTypes.JSONB, allowNull: false },
      fkUpdatedByUserId: ref(DataTypes, "fk_updated_by_user_id", true),
    },
    archivable("school_settings"),
  );

  SchoolSetting.associate = (models) => {
    SchoolSetting.belongsTo(models.Schools, { foreignKey: "fkSchoolId", as: "school" });
    SchoolSetting.belongsTo(models.Users, { foreignKey: "fkUpdatedByUserId", as: "updatedBy" });
  };

  return SchoolSetting;
};
