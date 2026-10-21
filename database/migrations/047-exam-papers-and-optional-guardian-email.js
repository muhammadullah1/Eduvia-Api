"use strict";

/**
 * Exam papers (EDUVIA-11).
 *
 * - A mark sheet is one exam paper (exam × class × subject). It gains the
 *   paper's date and start/end time; total and passing marks stay per paper.
 * - class_subjects carries the default paper total/passing marks used when an
 *   exam is scheduled.
 * - The old exam-level total/passing columns are dropped. Rows whose paper
 *   total had been copied from that exam-level total (e.g. 600 per paper)
 *   are reset to the class defaults. Every changed value is kept in
 *   exam_marks_legacy so `down` restores it exactly.
 * - Guardians without an email can be linked to a student: parents.fk_user_id
 *   becomes nullable and parents.guardian_name stores the name.
 * - A fee month opened for a student admitted after that month's due day was
 *   already overdue on admission. Its due date moves to admission + the
 *   school's due-day count (old value kept in fee_due_legacy).
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const q = (sql) => queryInterface.sequelize.query(sql, { transaction });

      await queryInterface.addColumn("class_subjects", "default_total_marks", {
        type: Sequelize.DECIMAL(6, 2), allowNull: false, defaultValue: 100,
      }, { transaction });
      await queryInterface.addColumn("class_subjects", "default_passing_marks", {
        type: Sequelize.DECIMAL(6, 2), allowNull: false, defaultValue: 40,
      }, { transaction });
      await q(`ALTER TABLE class_subjects ADD CONSTRAINT chk_class_subjects_default_marks
        CHECK (default_total_marks > 0 AND default_passing_marks >= 0 AND default_passing_marks <= default_total_marks)`);

      await queryInterface.addColumn("mark_sheets", "paper_date", { type: Sequelize.DATEONLY, allowNull: true }, { transaction });
      await queryInterface.addColumn("mark_sheets", "start_time", { type: Sequelize.TIME, allowNull: true }, { transaction });
      await queryInterface.addColumn("mark_sheets", "end_time", { type: Sequelize.TIME, allowNull: true }, { transaction });
      await q(`ALTER TABLE mark_sheets ALTER COLUMN total_marks TYPE NUMERIC(6,2), ALTER COLUMN passing_marks TYPE NUMERIC(6,2)`);

      await q(`CREATE TABLE exam_marks_legacy (
        kind VARCHAR(10) NOT NULL,
        ref_id INTEGER NOT NULL,
        total_marks NUMERIC(6,2) NOT NULL,
        passing_marks NUMERIC(6,2) NOT NULL,
        PRIMARY KEY (kind, ref_id)
      )`);
      await q(`INSERT INTO exam_marks_legacy (kind, ref_id, total_marks, passing_marks)
        SELECT 'exam', id, total_marks, passing_marks FROM exams`);

      // Paper totals that were copied from a multi-paper exam-level total.
      await q(`INSERT INTO exam_marks_legacy (kind, ref_id, total_marks, passing_marks)
        SELECT 'sheet', ms.id, ms.total_marks, ms.passing_marks
        FROM mark_sheets ms JOIN exams e ON e.id = ms.fk_exam_id
        WHERE e.total_marks > 100 AND ms.total_marks = e.total_marks
          AND NOT EXISTS (SELECT 1 FROM mark_sheet_rows r WHERE r.fk_mark_sheet_id = ms.id AND r.obtained_marks > 100)`);
      await q(`UPDATE mark_sheets ms
        SET total_marks = COALESCE(cs.default_total_marks, 100),
            passing_marks = COALESCE(cs.default_passing_marks, 40)
        FROM exam_marks_legacy l, mark_sheets src
        LEFT JOIN class_subjects cs ON cs.fk_class_id = src.fk_class_id AND cs.fk_subject_id = src.fk_subject_id
        WHERE l.kind = 'sheet' AND l.ref_id = ms.id AND src.id = ms.id`);
      await q(`ALTER TABLE mark_sheets ADD CONSTRAINT chk_mark_sheets_paper_marks
        CHECK (total_marks > 0 AND passing_marks >= 0 AND passing_marks <= total_marks)`);
      await q(`ALTER TABLE mark_sheets ADD CONSTRAINT chk_mark_sheets_paper_time
        CHECK (start_time IS NULL OR end_time IS NULL OR end_time > start_time)`);

      await queryInterface.removeColumn("exams", "total_marks", { transaction });
      await queryInterface.removeColumn("exams", "passing_marks", { transaction });

      await queryInterface.addColumn("parents", "guardian_name", { type: Sequelize.STRING(100), allowNull: true }, { transaction });
      await q(`UPDATE parents p SET guardian_name = TRIM(u.first_name || ' ' || NULLIF(u.last_name, '-'))
        FROM users u WHERE u.id = p.fk_user_id`);
      await q(`UPDATE parents SET guardian_name = TRIM(BOTH ' ' FROM guardian_name)`);
      await q(`ALTER TABLE parents ALTER COLUMN fk_user_id DROP NOT NULL`);

      await q(`CREATE TABLE fee_due_legacy (fee_month_id INTEGER PRIMARY KEY, due_date DATE)`);
      await q(`INSERT INTO fee_due_legacy (fee_month_id, due_date)
        SELECT f.id, f.due_date FROM student_fee_months f JOIN students s ON s.id = f.fk_student_id
        WHERE f.month = to_char(s.admission_date, 'YYYY-MM') AND f.due_date < s.admission_date`);
      await q(`UPDATE student_fee_months f
        SET due_date = s.admission_date + EXTRACT(DAY FROM l.due_date)::int
        FROM fee_due_legacy l, students s
        WHERE l.fee_month_id = f.id AND s.id = f.fk_student_id`);
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const q = (sql) => queryInterface.sequelize.query(sql, { transaction });
      const [[{ orphans }]] = await q(`SELECT COUNT(*)::int AS orphans FROM parents WHERE fk_user_id IS NULL`);
      if (orphans > 0) {
        throw new Error(`${orphans} guardian(s) have no portal account; give them an email before rolling back.`);
      }
      await q(`UPDATE student_fee_months f SET due_date = l.due_date FROM fee_due_legacy l WHERE l.fee_month_id = f.id`);
      await q(`DROP TABLE fee_due_legacy`);
      await q(`ALTER TABLE parents ALTER COLUMN fk_user_id SET NOT NULL`);
      await queryInterface.removeColumn("parents", "guardian_name", { transaction });

      await queryInterface.addColumn("exams", "total_marks", { type: Sequelize.DECIMAL(5, 2), allowNull: false, defaultValue: 100 }, { transaction });
      await queryInterface.addColumn("exams", "passing_marks", { type: Sequelize.DECIMAL(5, 2), allowNull: false, defaultValue: 40 }, { transaction });
      await q(`UPDATE exams e SET total_marks = l.total_marks, passing_marks = l.passing_marks
        FROM exam_marks_legacy l WHERE l.kind = 'exam' AND l.ref_id = e.id`);
      // Exams created after the migration: use the largest paper as the exam-level value.
      await q(`UPDATE exams e SET total_marks = LEAST(s.total, 999), passing_marks = LEAST(s.passing, 999)
        FROM (SELECT fk_exam_id, MAX(total_marks) total, MAX(passing_marks) passing FROM mark_sheets GROUP BY fk_exam_id) s
        WHERE s.fk_exam_id = e.id AND NOT EXISTS (SELECT 1 FROM exam_marks_legacy l WHERE l.kind = 'exam' AND l.ref_id = e.id)`);

      await q(`ALTER TABLE mark_sheets DROP CONSTRAINT chk_mark_sheets_paper_time`);
      await q(`ALTER TABLE mark_sheets DROP CONSTRAINT chk_mark_sheets_paper_marks`);
      await q(`UPDATE mark_sheets ms SET total_marks = l.total_marks, passing_marks = l.passing_marks
        FROM exam_marks_legacy l WHERE l.kind = 'sheet' AND l.ref_id = ms.id`);
      await q(`ALTER TABLE mark_sheets ALTER COLUMN total_marks TYPE NUMERIC(5,2), ALTER COLUMN passing_marks TYPE NUMERIC(5,2)`);
      await q(`DROP TABLE exam_marks_legacy`);
      await queryInterface.removeColumn("mark_sheets", "end_time", { transaction });
      await queryInterface.removeColumn("mark_sheets", "start_time", { transaction });
      await queryInterface.removeColumn("mark_sheets", "paper_date", { transaction });

      await q(`ALTER TABLE class_subjects DROP CONSTRAINT chk_class_subjects_default_marks`);
      await queryInterface.removeColumn("class_subjects", "default_passing_marks", { transaction });
      await queryInterface.removeColumn("class_subjects", "default_total_marks", { transaction });
    });
  },
};
