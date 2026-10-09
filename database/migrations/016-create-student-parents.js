"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("student_parents", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      fk_student_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "students",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      fk_parent_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "parents",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      relationship_type: {
        type: Sequelize.ENUM("Father", "Mother", "Guardian"),
        allowNull: false,
        defaultValue: "Guardian",
      },
      is_primary: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });

    await queryInterface.addIndex("student_parents", ["fk_student_id", "fk_parent_id"], {
      unique: true,
      name: "idx_student_parents_student_parent_unique",
    });

    await queryInterface.addIndex("student_parents", ["fk_parent_id"], {
      name: "idx_student_parents_parent",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("student_parents");
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_student_parents_relationship_type";');
  },
};
