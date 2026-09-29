"use strict";

const bcrypt = require("bcryptjs");

/**
 * Creative Leaders sample data for EDUVIA-4 extensions.
 * Safe to re-run: skips when school email already exists.
 */
module.exports = {
  async up(queryInterface) {
    const [existing] = await queryInterface.sequelize.query(
      `SELECT id FROM schools WHERE email = 'admin@cls.edu.pk' LIMIT 1;`,
    );
    if (existing.length) {
      // Extend existing demo if present
      const schoolId = existing[0].id;
      await seedExtensions(queryInterface, schoolId);
      return;
    }

    const now = new Date();
    const password = await bcrypt.hash("password", 10);

    await queryInterface.bulkInsert("schools", [
      {
        school_name: "Creative Leaders School",
        phone: "042-111-257257",
        address: "Lahore, Pakistan",
        email: "admin@cls.edu.pk",
        website: "https://creativeleaders.edu.pk",
        logo: null,
        archived_at: null,
        created_at: now,
        updated_at: now,
      },
    ]);
    const [schools] = await queryInterface.sequelize.query(
      `SELECT id FROM schools WHERE email = 'admin@cls.edu.pk' LIMIT 1;`,
    );
    const schoolId = schools[0].id;

    await queryInterface.bulkInsert("users", [
      {
        fk_school_id: schoolId,
        first_name: "Ayesha",
        last_name: "Khan",
        email: "admin@cls.edu.pk",
        phone: "0300-1110001",
        password,
        gender: "Female",
        photo: null,
        role: "management",
        status: "active",
        last_login: null,
        date_of_birth: null,
        archived_by: null,
        archived_at: null,
        created_at: now,
        updated_at: now,
      },
      {
        fk_school_id: schoolId,
        first_name: "Imran",
        last_name: "Shah",
        email: "controller@cls.edu.pk",
        phone: "0300-1110002",
        password,
        gender: "Male",
        photo: null,
        role: "controller",
        status: "active",
        last_login: null,
        date_of_birth: null,
        archived_by: null,
        archived_at: null,
        created_at: now,
        updated_at: now,
      },
      {
        fk_school_id: schoolId,
        first_name: "Nadia",
        last_name: "Iqbal",
        email: "fees@cls.edu.pk",
        phone: "0300-1110003",
        password,
        gender: "Female",
        photo: null,
        role: "accountant",
        status: "active",
        last_login: null,
        date_of_birth: null,
        archived_by: null,
        archived_at: null,
        created_at: now,
        updated_at: now,
      },
      {
        fk_school_id: schoolId,
        first_name: "Hassan",
        last_name: "Ali",
        email: "hassan@cls.edu.pk",
        phone: "0301-5550190",
        password,
        gender: "Male",
        photo: null,
        role: "teacher",
        status: "active",
        last_login: null,
        date_of_birth: null,
        archived_by: null,
        archived_at: null,
        created_at: now,
        updated_at: now,
      },
      {
        fk_school_id: schoolId,
        first_name: "Sara",
        last_name: "Ahmed",
        email: "parent@cls.edu.pk",
        phone: "0300-2220001",
        password,
        gender: "Female",
        photo: null,
        role: "parent",
        status: "active",
        last_login: null,
        date_of_birth: null,
        archived_by: null,
        archived_at: null,
        created_at: now,
        updated_at: now,
      },
    ]);

    await queryInterface.bulkInsert("academic_sessions", [
      {
        fk_school_id: schoolId,
        name: "2026–27",
        start_date: "2026-04-01",
        end_date: "2027-03-31",
        is_current: true,
        archived_at: null,
        created_at: now,
        updated_at: now,
      },
    ]);
    const [sessions] = await queryInterface.sequelize.query(
      `SELECT id FROM academic_sessions WHERE fk_school_id = ${schoolId} AND is_current = true LIMIT 1;`,
    );
    const sessionId = sessions[0].id;

    await queryInterface.bulkInsert("subjects", [
      { fk_school_id: schoolId, name: "English", code: "ENG", archived_at: null, created_at: now, updated_at: now },
      { fk_school_id: schoolId, name: "Mathematics", code: "MTH", archived_at: null, created_at: now, updated_at: now },
      { fk_school_id: schoolId, name: "General Science", code: "SCI", archived_at: null, created_at: now, updated_at: now },
      { fk_school_id: schoolId, name: "Urdu", code: "URD", archived_at: null, created_at: now, updated_at: now },
      { fk_school_id: schoolId, name: "Computer Studies", code: "CS", archived_at: null, created_at: now, updated_at: now },
    ]);

    await queryInterface.bulkInsert("classes", [
      {
        fk_school_id: schoolId,
        fk_session_id: sessionId,
        grade: "Grade 7",
        section: "Blue",
        label: "Grade 7 · Blue",
        room: "Room 14",
        period_count: 8,
        archived_at: null,
        created_at: now,
        updated_at: now,
      },
      {
        fk_school_id: schoolId,
        fk_session_id: sessionId,
        grade: "Grade 8",
        section: "Blue",
        label: "Grade 8 · Blue",
        room: "Room 18",
        period_count: 9,
        archived_at: null,
        created_at: now,
        updated_at: now,
      },
      {
        fk_school_id: schoolId,
        fk_session_id: sessionId,
        grade: "Grade 6",
        section: "Red",
        label: "Grade 6 · Red",
        room: "Lab 02",
        period_count: 7,
        archived_at: null,
        created_at: now,
        updated_at: now,
      },
    ]);

    const [users] = await queryInterface.sequelize.query(
      `SELECT id, email FROM users WHERE fk_school_id = ${schoolId};`,
    );
    const [subjects] = await queryInterface.sequelize.query(
      `SELECT id, code FROM subjects WHERE fk_school_id = ${schoolId};`,
    );
    const [classes] = await queryInterface.sequelize.query(
      `SELECT id, label FROM classes WHERE fk_school_id = ${schoolId};`,
    );
    const byEmail = Object.fromEntries(users.map((u) => [u.email, u.id]));
    const byCode = Object.fromEntries(subjects.map((s) => [s.code, s.id]));
    const class7 = classes.find((c) => c.label.includes("Grade 7"))?.id;

    await queryInterface.bulkInsert("teachers", [
      {
        fk_user_id: byEmail["hassan@cls.edu.pk"],
        fk_school_id: schoolId,
        employee_code: "T-HA-01",
        fk_primary_subject_id: byCode.MTH,
        archived_at: null,
        created_at: now,
        updated_at: now,
      },
    ]);
    const [teachers] = await queryInterface.sequelize.query(
      `SELECT id FROM teachers WHERE fk_school_id = ${schoolId} LIMIT 1;`,
    );
    const teacherId = teachers[0].id;

    await queryInterface.bulkInsert("teacher_subjects", [
      { fk_teacher_id: teacherId, fk_subject_id: byCode.MTH, created_at: now, updated_at: now },
    ]);
    if (class7) {
      await queryInterface.bulkInsert("teacher_classes", [
        { fk_teacher_id: teacherId, fk_class_id: class7, created_at: now, updated_at: now },
      ]);
    }

    await queryInterface.bulkInsert("students", [
      {
        fk_school_id: schoolId,
        fk_class_id: class7,
        admission_no: "CLS-24118",
        first_name: "Rayan",
        last_name: "Ahmed",
        gender: "Male",
        dob: "2013-04-12",
        status: "Active",
        admitted_on: "2026-04-01",
        archived_at: null,
        created_at: now,
        updated_at: now,
      },
      {
        fk_school_id: schoolId,
        fk_class_id: class7,
        admission_no: "CLS-24122",
        first_name: "Ayaan",
        last_name: "Malik",
        gender: "Male",
        dob: "2013-02-14",
        status: "Active",
        admitted_on: "2026-04-01",
        archived_at: null,
        created_at: now,
        updated_at: now,
      },
    ]);

    await queryInterface.bulkInsert("parents", [
      {
        fk_user_id: byEmail["parent@cls.edu.pk"],
        fk_school_id: schoolId,
        relation: "Mother",
        archived_at: null,
        created_at: now,
        updated_at: now,
      },
    ]);

    const [students] = await queryInterface.sequelize.query(
      `SELECT id, admission_no FROM students WHERE fk_school_id = ${schoolId};`,
    );
    const [parents] = await queryInterface.sequelize.query(
      `SELECT id FROM parents WHERE fk_school_id = ${schoolId} LIMIT 1;`,
    );
    const rayan = students.find((s) => s.admission_no === "CLS-24118");
    if (rayan && parents[0]) {
      await queryInterface.bulkInsert("student_parents", [
        {
          fk_student_id: rayan.id,
          fk_parent_id: parents[0].id,
          is_primary: true,
          created_at: now,
          updated_at: now,
        },
      ]);
      await queryInterface.bulkInsert("fee_payments", [
        {
          fk_school_id: schoolId,
          ref: "RCPT-0926-482",
          fk_student_id: rayan.id,
          period: "September 2026",
          type: "Tuition",
          amount: 8500,
          method: "Cash",
          status: "Paid",
          paid_on: "2026-09-05",
          due_date: "2026-09-10",
          notes: "Parent portal aligned tuition receipt",
          archived_at: null,
          created_at: now,
          updated_at: now,
        },
      ]);
    }

    await seedExtensions(queryInterface, schoolId);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      `DELETE FROM schools WHERE email = 'admin@cls.edu.pk';`,
    );
  },
};

async function seedExtensions(queryInterface, schoolId) {
  const now = new Date();
  const [classes] = await queryInterface.sequelize.query(
    `SELECT id, label, period_count FROM classes WHERE fk_school_id = ${schoolId};`,
  );
  const [teachers] = await queryInterface.sequelize.query(
    `SELECT id FROM teachers WHERE fk_school_id = ${schoolId} LIMIT 1;`,
  );
  const [subjects] = await queryInterface.sequelize.query(
    `SELECT id, code FROM subjects WHERE fk_school_id = ${schoolId};`,
  );
  const [students] = await queryInterface.sequelize.query(
    `SELECT id, admission_no FROM students WHERE fk_school_id = ${schoolId};`,
  );
  if (!classes.length || !teachers.length || !subjects.length) return;

  const class7 = classes.find((c) => String(c.label).includes("Grade 7")) || classes[0];
  const teacherId = teachers[0].id;
  const math = subjects.find((s) => s.code === "MTH") || subjects[0];
  const rayan = students.find((s) => s.admission_no === "CLS-24118") || students[0];
  const ayaan = students.find((s) => s.admission_no === "CLS-24122") || students[1] || students[0];

  // Ensure period_count diversity
  for (const row of classes) {
    if (!row.period_count) {
      await queryInterface.sequelize.query(
        `UPDATE classes SET period_count = 8 WHERE id = ${row.id};`,
      );
    }
  }

  const [absCount] = await queryInterface.sequelize.query(
    `SELECT COUNT(*)::int AS c FROM teacher_absences WHERE fk_school_id = ${schoolId};`,
  );
  if (absCount[0].c === 0) {
    await queryInterface.bulkInsert("teacher_absences", [
      {
        fk_school_id: schoolId,
        fk_teacher_id: teacherId,
        fk_class_id: class7.id,
        fk_timetable_slot_id: null,
        date: "2026-09-23",
        period_index: 3,
        status: "Unmanaged",
        fk_cover_teacher_id: null,
        notes: "Teacher reported sick; period unmanaged pending cover",
        archived_at: null,
        created_at: now,
        updated_at: now,
      },
      {
        fk_school_id: schoolId,
        fk_teacher_id: teacherId,
        fk_class_id: class7.id,
        fk_timetable_slot_id: null,
        date: "2026-09-22",
        period_index: 2,
        status: "Covered",
        fk_cover_teacher_id: teacherId,
        notes: "Self-cover demo row (replace with second teacher in prod)",
        archived_at: null,
        created_at: now,
        updated_at: now,
      },
    ]);
  }

  const [lessonCount] = await queryInterface.sequelize.query(
    `SELECT COUNT(*)::int AS c FROM daily_lessons WHERE fk_school_id = ${schoolId};`,
  );
  if (lessonCount[0].c === 0) {
    await queryInterface.bulkInsert("daily_lessons", [
      {
        fk_school_id: schoolId,
        fk_class_id: class7.id,
        fk_subject_id: math.id,
        fk_teacher_id: teacherId,
        date: "2026-09-23",
        period_index: 2,
        chapter: "Chapter 4 — Linear Equations",
        title: "Solving two-step equations",
        notes: "Board work + worksheet",
        progress: 70,
        status: "In progress",
        archived_at: null,
        created_at: now,
        updated_at: now,
      },
      {
        fk_school_id: schoolId,
        fk_class_id: class7.id,
        fk_subject_id: math.id,
        fk_teacher_id: teacherId,
        date: "2026-09-22",
        period_index: 2,
        chapter: "Chapter 3 — Algebra basics",
        title: "Revision",
        notes: null,
        progress: 100,
        status: "Completed",
        archived_at: null,
        created_at: now,
        updated_at: now,
      },
    ]);
  }

  const [dtCount] = await queryInterface.sequelize.query(
    `SELECT COUNT(*)::int AS c FROM daily_tests WHERE fk_school_id = ${schoolId};`,
  );
  if (dtCount[0].c === 0 && rayan) {
    await queryInterface.bulkInsert("daily_tests", [
      {
        fk_school_id: schoolId,
        fk_class_id: class7.id,
        fk_subject_id: math.id,
        fk_teacher_id: teacherId,
        date: "2026-09-23",
        period_index: 2,
        title: "Quick quiz — equations",
        max_score: 20,
        archived_at: null,
        created_at: now,
        updated_at: now,
      },
    ]);
    const [tests] = await queryInterface.sequelize.query(
      `SELECT id FROM daily_tests WHERE fk_school_id = ${schoolId} ORDER BY id DESC LIMIT 1;`,
    );
    await queryInterface.bulkInsert("daily_test_results", [
      {
        fk_daily_test_id: tests[0].id,
        fk_student_id: rayan.id,
        score: 16,
        created_at: now,
        updated_at: now,
      },
      {
        fk_daily_test_id: tests[0].id,
        fk_student_id: ayaan.id,
        score: 11,
        created_at: now,
        updated_at: now,
      },
    ]);
  }

  const [mtCount] = await queryInterface.sequelize.query(
    `SELECT COUNT(*)::int AS c FROM monthly_tests WHERE fk_school_id = ${schoolId};`,
  );
  if (mtCount[0].c === 0 && rayan) {
    const titles = ["Monthly Test 1", "Monthly Test 2", "Monthly Test 3", "Monthly Test 4"];
    // Rayan: pass, pass, pass (low avg → LowMarks). Ayaan: fail, fail → Failed
    const rayanScores = [48, 52, 50, 70];
    const ayaanScores = [30, 28, 60, 55];
    for (let i = 0; i < titles.length; i += 1) {
      await queryInterface.bulkInsert("monthly_tests", [
        {
          fk_school_id: schoolId,
          fk_session_id: null,
          fk_class_id: class7.id,
          fk_subject_id: math.id,
          month: "2026-09",
          title: titles[i],
          max_score: 100,
          pass_percent: 40,
          test_date: `2026-09-${String(5 + i * 5).padStart(2, "0")}`,
          archived_at: null,
          created_at: now,
          updated_at: now,
        },
      ]);
      const [mt] = await queryInterface.sequelize.query(
        `SELECT id FROM monthly_tests WHERE fk_school_id = ${schoolId} AND title = '${titles[i]}' ORDER BY id DESC LIMIT 1;`,
      );
      const rPass = rayanScores[i] >= 40;
      const aPass = ayaanScores[i] >= 40;
      await queryInterface.bulkInsert("monthly_test_results", [
        {
          fk_monthly_test_id: mt[0].id,
          fk_student_id: rayan.id,
          score: rayanScores[i],
          passed: rPass,
          created_at: now,
          updated_at: now,
        },
        {
          fk_monthly_test_id: mt[0].id,
          fk_student_id: ayaan.id,
          score: ayaanScores[i],
          passed: aPass,
          created_at: now,
          updated_at: now,
        },
      ]);
    }

    await queryInterface.bulkInsert("monthly_student_summaries", [
      {
        fk_school_id: schoolId,
        fk_class_id: class7.id,
        fk_subject_id: math.id,
        fk_student_id: rayan.id,
        month: "2026-09",
        tests_taken: 4,
        passed_count: 4,
        failed_count: 0,
        average_percent: 55.0,
        status: "LowMarks",
        created_at: now,
        updated_at: now,
      },
      {
        fk_school_id: schoolId,
        fk_class_id: class7.id,
        fk_subject_id: math.id,
        fk_student_id: ayaan.id,
        month: "2026-09",
        tests_taken: 4,
        passed_count: 2,
        failed_count: 2,
        average_percent: 43.25,
        status: "Failed",
        created_at: now,
        updated_at: now,
      },
    ]);
  }
}
