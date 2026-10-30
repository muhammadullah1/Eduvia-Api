"use strict";

const bcrypt = require("bcryptjs");

/**
 * Empty school for a test deploy.
 * Password for every account is `password`.
 *
 * Seeds the school, the current session, default settings, and one login
 * for each role. No classes, students, fees, or timetable, so testers
 * create those records themselves.
 */

const SCHOOL_EMAIL = "admin@cls.edu.pk";
const SESSION = { name: "2026–27", start: "2026-04-01", end: "2027-03-31" };

const USERS = [
  { email: "admin@cls.edu.pk", first: "Ayesha", last: "Khan", role: "super_admin", gender: "Female", phone: "0300-1000001" },
  { email: "operations@cls.edu.pk", first: "Imran", last: "Shah", role: "operations_manager", gender: "Male", phone: "0300-2000001" },
  { email: "accountant@cls.edu.pk", first: "Nadia", last: "Iqbal", role: "accountant", gender: "Female", phone: "0300-3000001" },
  { email: "hassan@cls.edu.pk", first: "Hassan", last: "Ali", role: "teacher", gender: "Male", phone: "0301-1010101" },
  { email: "parent@cls.edu.pk", first: "Sara", last: "Ahmed", role: "parent", gender: "Female", phone: "0321-1112233" },
];

module.exports = {
  async up(queryInterface) {
    const qi = queryInterface;
    const [[found]] = await qi.sequelize.query(
      `SELECT id FROM schools WHERE email = :email LIMIT 1`,
      { replacements: { email: SCHOOL_EMAIL } },
    );
    if (found) return;

    await qi.sequelize.transaction(async (transaction) => {
      const now = new Date();
      const stamp = (row) => ({ created_at: now, updated_at: now, ...row });
      const insert = async (table, rows) =>
        qi.bulkInsert(table, rows.map(stamp), { transaction, returning: true });
      const password = await bcrypt.hash("password", 10);

      const [school] = await insert("schools", [{
        name: "Creative Leaders School",
        code: "CLS",
        phone: "042-111-257257",
        email: SCHOOL_EMAIL,
        address: "Lahore, Pakistan",
        website: "https://creativeleaders.edu.pk",
        status: "active",
      }]);
      const withSchool = (row) => ({ fk_school_id: school.id, ...row });

      await insert("academic_sessions", [
        withSchool({
          name: SESSION.name,
          start_date: SESSION.start,
          end_date: SESSION.end,
          is_current: true,
        }),
      ]);

      await insert("school_settings", [
        ["dailyTestRules", { passPercent: 40, maxFailsPerMonth: 1, lowMarksEnabled: true, lowMarksMinPassed: 3, lowMarksBelowPercent: 55 }],
        ["resultVisibility", { feeRule: "all_due_paid", requireOverrideReason: true }],
        ["fees", {
          dueDay: 10,
          maxAdvanceMonths: 12,
          concessionPolicy: {
            allowedModes: ["percent", "fixed_discount", "waiver"],
            approvalRule: "none",
            approvalPercentAbove: null,
            approvalAmountAbove: null,
          },
        }],
        ["admission", { prefix: "CLS", digits: 4 }],
      ].map(([key, value]) => withSchool({ key, value: JSON.stringify(value) })));

      const [subject] = await insert("subjects", [
        withSchool({ name: "Mathematics", code: "MTH", is_active: true }),
      ]);

      const users = await insert("users", USERS.map((user) => withSchool({
        first_name: user.first,
        last_name: user.last,
        email: user.email,
        phone: user.phone,
        password,
        gender: user.gender,
        role: user.role,
        status: "active",
      })));
      const userBy = Object.fromEntries(users.map((user) => [user.email, user]));
      const teacherUser = userBy["hassan@cls.edu.pk"];
      const parentUser = userBy["parent@cls.edu.pk"];
      const ops = userBy["operations@cls.edu.pk"];

      const [teacher] = await insert("teachers", [withSchool({
        fk_user_id: teacherUser.id,
        fk_subject_id: subject.id,
        employee_code: "T-101",
        qualification: "B.Ed.",
        joining_date: SESSION.start,
        status: "Active",
      })]);

      await insert("teacher_subject_assignments", [withSchool({
        fk_teacher_id: teacher.id,
        fk_subject_id: subject.id,
        effective_from: SESSION.start,
        fk_assigned_by_user_id: ops.id,
        reason: "Initial subject so the teacher account can sign in",
      })]);

      await insert("parents", [withSchool({
        fk_user_id: parentUser.id,
        primary_contact_number: parentUser.phone,
      })]);
    });
  },

  async down(queryInterface) {
    const qi = queryInterface;
    const [[school]] = await qi.sequelize.query(
      `SELECT id FROM schools WHERE email = :email LIMIT 1`,
      { replacements: { email: SCHOOL_EMAIL } },
    );
    if (!school) return;
    const id = school.id;
    await qi.sequelize.transaction(async (transaction) => {
      const q = (sql) => qi.sequelize.query(sql, { replacements: { id }, transaction });
      await q(`DELETE FROM teacher_subject_assignments WHERE fk_school_id = :id`);
      await q(`DELETE FROM teachers WHERE fk_school_id = :id`);
      await q(`DELETE FROM parents WHERE fk_school_id = :id`);
      await q(`DELETE FROM subjects WHERE fk_school_id = :id`);
      await q(`DELETE FROM school_settings WHERE fk_school_id = :id`);
      await q(`DELETE FROM academic_sessions WHERE fk_school_id = :id`);
      await q(`DELETE FROM users WHERE fk_school_id = :id`);
      await q(`DELETE FROM schools WHERE id = :id`);
    });
  },
};
