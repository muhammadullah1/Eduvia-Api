"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("locations", "fk_session_id", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: "academic_sessions", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });

    await queryInterface.sequelize.query(`
      UPDATE locations AS l
      SET fk_session_id = s.id
      FROM academic_sessions AS s
      WHERE s.fk_school_id = l.fk_school_id
        AND s.is_current = true
        AND l.fk_session_id IS NULL
    `);
    await queryInterface.sequelize.query(`
      UPDATE locations AS l
      SET fk_session_id = (
        SELECT s.id FROM academic_sessions AS s
        WHERE s.fk_school_id = l.fk_school_id
        ORDER BY s.id DESC
        LIMIT 1
      )
      WHERE l.fk_session_id IS NULL
    `);

    await queryInterface.sequelize.query(`
      UPDATE locations
      SET name = room_name
      WHERE room_name IS NOT NULL AND btrim(room_name) <> ''
    `);

    await queryInterface.renameColumn("locations", "room_code", "location_code");
    await queryInterface.removeColumn("locations", "room_name");
    await queryInterface.removeColumn("locations", "selection_type");
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_locations_selection_type";',
    );

    await queryInterface.changeColumn("locations", "fk_session_id", {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: { model: "academic_sessions", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });

    await queryInterface.sequelize.query(
      "DROP INDEX IF EXISTS idx_locations_school_room_active_unique",
    );
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX idx_locations_session_name_active_unique
      ON locations (fk_school_id, fk_session_id, lower(name))
      WHERE archived_at IS NULL
    `);
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX idx_locations_session_code_active_unique
      ON locations (fk_school_id, fk_session_id, lower(location_code))
      WHERE archived_at IS NULL AND location_code IS NOT NULL AND btrim(location_code) <> ''
    `);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      "DROP INDEX IF EXISTS idx_locations_session_code_active_unique",
    );
    await queryInterface.sequelize.query(
      "DROP INDEX IF EXISTS idx_locations_session_name_active_unique",
    );
    await queryInterface.addColumn("locations", "room_name", {
      type: Sequelize.STRING(120),
      allowNull: true,
    });
    await queryInterface.sequelize.query(
      "UPDATE locations SET room_name = name WHERE room_name IS NULL",
    );
    await queryInterface.changeColumn("locations", "room_name", {
      type: Sequelize.STRING(120),
      allowNull: false,
    });
    await queryInterface.addColumn("locations", "selection_type", {
      type: Sequelize.ENUM("home", "away"),
      allowNull: false,
      defaultValue: "home",
    });
    await queryInterface.renameColumn("locations", "location_code", "room_code");
    await queryInterface.removeColumn("locations", "fk_session_id");
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX idx_locations_school_room_active_unique
      ON locations (fk_school_id, lower(room_name))
      WHERE archived_at IS NULL
    `);
  },
};
