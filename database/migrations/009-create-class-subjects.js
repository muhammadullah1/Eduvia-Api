"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const { Op } = Sequelize;

    await queryInterface.createTable("class_subjects", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      fk_class_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "classes", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      fk_subject_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "subjects", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      periods_per_week: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 5,
      },
      is_elective: {
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
      default_total_marks: {
        type: Sequelize.DECIMAL(6, 2),
        allowNull: false,
        defaultValue: 100,
      },
      default_passing_marks: {
        type: Sequelize.DECIMAL(6, 2),
        allowNull: false,
        defaultValue: 40,
      },
    });

    await queryInterface.addIndex(
      "class_subjects",
      ["fk_class_id", "fk_subject_id"],
      { name: "idx_class_subjects_class_subject_unique", unique: true },
    );
    await queryInterface.addConstraint("class_subjects", {
      fields: ["default_total_marks", "default_passing_marks"],
      type: "check",
      name: "chk_class_subjects_default_marks",
      where: {
        [Op.and]: [
          { default_total_marks: { [Op.gt]: 0 } },
          { default_passing_marks: { [Op.gte]: 0 } },
          {
            default_passing_marks: {
              [Op.lte]: Sequelize.col("default_total_marks"),
            },
          },
        ],
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("class_subjects");
  },
};
