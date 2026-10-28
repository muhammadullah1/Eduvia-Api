"use strict";

module.exports = (sequelize, DataTypes) => {
  const StudentFeeConcessionEvent = sequelize.define(
    "student_fee_concession_events",
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER,
      },
      fkConcessionId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "fk_concession_id",
        validate: {
          isInt: true,
        },
      },
      eventType: {
        type: DataTypes.STRING(40),
        allowNull: false,
        field: "event_type",
      },
      fromStatus: {
        type: DataTypes.STRING(30),
        allowNull: true,
        field: "from_status",
      },
      toStatus: {
        type: DataTypes.STRING(30),
        allowNull: true,
        field: "to_status",
      },
      fkActorUserId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: "fk_actor_user_id",
        validate: {
          isInt: true,
        },
      },
      payload: {
        type: DataTypes.JSONB,
        allowNull: true,
      },
    },
    {
      tableName: "student_fee_concession_events",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: false,
      underscored: true,
    }
  );

  StudentFeeConcessionEvent.associate = (models) => {
    StudentFeeConcessionEvent.belongsTo(models.StudentFeeConcessions, {
      foreignKey: "fkConcessionId",
      as: "concession",
    });
    StudentFeeConcessionEvent.belongsTo(models.Users, {
      foreignKey: "fkActorUserId",
      as: "actor",
    });
  };

  return StudentFeeConcessionEvent;
};
