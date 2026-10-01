"use strict";

const bcrypt = require("bcryptjs");
const { summarizeMonth } = require("../../utils/monthly_status");
const { SETTING_DEFAULTS, WEEKDAYS } = require("../../constants");

/**
 * Creative Leaders School demo (EDUVIA-4 + SRS Addendum v1.1).
 *
 * Populates a realistic development/demo environment:
 * - 3 users for each applicable role (super_admin, operations_manager, accountant)
 * - 12 teachers covering core subjects with conflict-free timetables
 * - 11 classes: KG through Grade 10
 * - 50 students per class (550 students total) with realistic parent-child relationships & shared siblings
 * - Preserves all SRS v1.1 demo test flows:
 *     Ayaan Butt (fee overdue, 2 failed Maths tests -> Failed + flagged, fee-withheld)
 *     Daniyal Khan (August partially paid, released by audited override)
 *     Rayan Ahmed (paid through October Advance, visible result)
 *     Zara Ahmed (September unpaid, withheld result, shared parent Sara Ahmed)
 *     Hassan Ali absent on demo day Tue 29 Sep 2026 (covered period + pending periods)
 *     Nadia Iqbal + other accountants with daily collection receipts
 * - Populates all 33 database tables relationally and deterministically.
 */

const SCHOOL_EMAIL = "admin@cls.edu.pk";
const DEMO_DAY = "2026-09-29"; // Tuesday
const SESSION = { name: "2026–27", start: "2026-04-01", end: "2027-03-31" };
const PERIOD_TIMES = ["08:00", "08:40", "09:20", "10:00", "10:40", "11:20", "12:00", "12:40", "13:20"];
const SCHOOL_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

const SUBJECTS = [
  { code: "MTH", name: "Mathematics" },
  { code: "ENG", name: "English" },
  { code: "SCI", name: "Science" },
  { code: "URD", name: "Urdu" },
  { code: "CS", name: "Computer Science" },
  { code: "ISL", name: "Islamiyat" },
  { code: "SST", name: "Social Studies" },
  { code: "ART", name: "Arts" },
];

// Operational staff: 3 Super Admins, 3 Operations Managers, 3 Accountants
const OPERATIONAL_STAFF = [
  // Super Admins
  { email: "admin@cls.edu.pk", first: "Ayesha", last: "Khan", role: "super_admin", gender: "Female" },
  { email: "tariq.admin@cls.edu.pk", first: "Tariq", last: "Mehmood", role: "super_admin", gender: "Male" },
  { email: "maria.admin@cls.edu.pk", first: "Maria", last: "Aslam", role: "super_admin", gender: "Female" },
  // Operations Managers
  { email: "operations@cls.edu.pk", first: "Imran", last: "Shah", role: "operations_manager", gender: "Male" },
  { email: "bilal.ops@cls.edu.pk", first: "Bilal", last: "Akhtar", role: "operations_manager", gender: "Male" },
  { email: "sana.ops@cls.edu.pk", first: "Sana", last: "Farooq", role: "operations_manager", gender: "Female" },
  // Accountants
  { email: "accountant@cls.edu.pk", first: "Nadia", last: "Iqbal", role: "accountant", gender: "Female" },
  { email: "rashid.acc@cls.edu.pk", first: "Rashid", last: "Minhas", role: "accountant", gender: "Male" },
  { email: "hamza.acc@cls.edu.pk", first: "Hamza", last: "Sheikh", role: "accountant", gender: "Male" },
];

// 12 Teachers covering core subjects (allows conflict-free timetable across 11 classes)
const TEACHER_STAFF = [
  { email: "hassan@cls.edu.pk", first: "Hassan", last: "Ali", role: "teacher", gender: "Male", subject: "MTH", code: "T-101" },
  { email: "fatima@cls.edu.pk", first: "Fatima", last: "Noor", role: "teacher", gender: "Female", subject: "ENG", code: "T-102" },
  { email: "bilal@cls.edu.pk", first: "Bilal", last: "Raza", role: "teacher", gender: "Male", subject: "SCI", code: "T-103" },
  { email: "zainab@cls.edu.pk", first: "Zainab", last: "Malik", role: "teacher", gender: "Female", subject: "URD", code: "T-104" },
  { email: "omar@cls.edu.pk", first: "Omar", last: "Farooq", role: "teacher", gender: "Male", subject: "CS", code: "T-105" },
  { email: "aisha.t@cls.edu.pk", first: "Aisha", last: "Siddiqui", role: "teacher", gender: "Female", subject: "ISL", code: "T-106" },
  { email: "usman.t@cls.edu.pk", first: "Usman", last: "Tariq", role: "teacher", gender: "Male", subject: "SST", code: "T-107" },
  { email: "hira.t@cls.edu.pk", first: "Hira", last: "Jamil", role: "teacher", gender: "Female", subject: "ART", code: "T-108" },
  { email: "asad.m@cls.edu.pk", first: "Asad", last: "Mehmood", role: "teacher", gender: "Male", subject: "MTH", code: "T-109" },
  { email: "rabia.b@cls.edu.pk", first: "Rabia", last: "Basri", role: "teacher", gender: "Female", subject: "ENG", code: "T-110" },
  { email: "zayan.c@cls.edu.pk", first: "Zayan", last: "Cheema", role: "teacher", gender: "Male", subject: "SCI", code: "T-111" },
  { email: "maryam.n@cls.edu.pk", first: "Maryam", last: "Nawaz", role: "teacher", gender: "Female", subject: "URD", code: "T-112" },
];

// Classes: KG through Grade 10 (11 classes)
const CLASSES = [
  { key: "kg", grade: "KG", section: "Green", room: "K-01", periods: 6, fee: 7000 },
  { key: "g1", grade: "Grade 1", section: "Blue", room: "A-01", periods: 7, fee: 7500 },
  { key: "g2", grade: "Grade 2", section: "Blue", room: "A-02", periods: 7, fee: 7500 },
  { key: "g3", grade: "Grade 3", section: "Blue", room: "A-03", periods: 8, fee: 8000 },
  { key: "g4", grade: "Grade 4", section: "Blue", room: "B-01", periods: 8, fee: 8000 },
  { key: "g5", grade: "Grade 5", section: "Blue", room: "B-02", periods: 8, fee: 8000 },
  { key: "g6r", grade: "Grade 6", section: "Red", room: "B-03", periods: 7, fee: 8000 },
  { key: "g7b", grade: "Grade 7", section: "Blue", room: "B-12", periods: 8, fee: 8500 },
  { key: "g8b", grade: "Grade 8", section: "Blue", room: "B-14", periods: 9, fee: 9000 },
  { key: "g9", grade: "Grade 9", section: "Blue", room: "C-01", periods: 9, fee: 9500 },
  { key: "g10", grade: "Grade 10", section: "Blue", room: "C-02", periods: 9, fee: 10000 },
];

const FIRST_NAMES_MALE = [
  "Rayan", "Ayaan", "Daniyal", "Ali", "Usman", "Bilal", "Hamza", "Zaid", "Saad", "Mustafa",
  "Ibrahim", "Ahmed", "Farhan", "Haris", "Shahmeer", "Azan", "Rehan", "Fahad", "Taha", "Hashir",
  "Arham", "Affan", "Rohail", "Waleed", "Danish", "Zain", "Talha", "Yahya", "Zayan", "Asad",
  "Naveed", "Shoaib", "Anas", "Huzaifa", "Subhan", "Kashif", "Junaid", "Moiz", "Shehroz", "Raheem",
  "Salman", "Qasim", "Noman", "Waseem", "Shahzaib", "Shayan", "Hammad", "Mueed", "Basil", "Haider"
];

const FIRST_NAMES_FEMALE = [
  "Zara", "Hira", "Maham", "Fatima", "Ayesha", "Zainab", "Maryam", "Sana", "Anaya", "Hania",
  "Esha", "Dua", "Laiba", "Noor", "Kinza", "Bisma", "Rida", "Manahil", "Alishba", "Minahil",
  "Syeda", "Zunaira", "Bareera", "Meerab", "Zoya", "Hoorain", "Rabia", "Sarah", "Amna", "Khadija",
  "Iman", "Areeba", "Aleena", "Iqra", "Bushra", "Sidra", "Sadia", "Mehak", "Saman", "Javeria",
  "Fariha", "Hiba", "Ayla", "Inaya", "Pareeshay", "Dania", "Natasha", "Roomaisa", "Maleeha", "Warda"
];

const LAST_NAMES = [
  "Ahmed", "Khan", "Butt", "Malik", "Raza", "Tariq", "Javed", "Siddiqui", "Shah", "Farooq",
  "Iqbal", "Hussain", "Qureshi", "Sheikh", "Minhas", "Chaudhry", "Gill", "Mir", "Akhtar", "Aslam",
  "Rehman", "Baig", "Mehmood", "Dar", "Abbasi", "Hashmi", "Latif", "Bajwa", "Gujjar", "Lodhi"
];

const CHAPTERS = {
  "g7b:MTH": ["Integers", "Fractions and Decimals", "Algebraic Expressions", "Linear Equations", "Ratio and Proportion"],
  "g7b:ENG": ["Reading Comprehension", "Tenses in Context", "Formal Letter Writing"],
  "g7b:SCI": ["Cell Structure", "Nutrition in Plants", "Heat and Temperature"],
  "g8b:MTH": ["Rational Numbers", "Exponents and Powers", "Squares and Square Roots"],
  "g6r:MTH": ["Knowing Our Numbers", "Whole Numbers", "Playing with Numbers"],
  "g9:MTH": ["Real and Complex Numbers", "Logarithms", "Algebraic Manipulation"],
  "g10:MTH": ["Quadratic Equations", "Theory of Quadratic Equations", "Variations"],
};

/** Weekly subject test day per class (UR-05). */
const TEST_SCHEDULES = [
  { class: "g7b", subject: "MTH", weekday: "Thursday" },
  { class: "g7b", subject: "ENG", weekday: "Monday" },
  { class: "g7b", subject: "SCI", weekday: "Wednesday" },
  { class: "g8b", subject: "MTH", weekday: "Thursday" },
  { class: "g6r", subject: "MTH", weekday: "Thursday" },
  { class: "g9", subject: "MTH", weekday: "Tuesday" },
  { class: "g10", subject: "MTH", weekday: "Wednesday" },
];

/** Specific test scores for the demo scenario (max 20). */
const DEMO_TEST_SCORES = {
  "g7b:MTH": { rayan: [16, 18, 15, 17], ayaan: [6, 12, 7, 11], hira: [9, 10, 10, 10], daniyal: [14, 8, 13, 15] },
  "g7b:ENG": { rayan: [15, 17, 16, 18], ayaan: [7, 14, 13, 15], hira: [14, 15, 13, 16], daniyal: [12, 11, 14, 13] },
  "g7b:SCI": { rayan: [17, 16, 18, 15], ayaan: [11, 10, 12, 9], hira: [13, 12, 14, 13], daniyal: [15, 14, 12, 16] },
  "g8b:MTH": { maham: [18, 17, 19, 18], usman: [10, 9, 12, 11] },
};
const PUBLISHED_WEEKS = { "g7b:MTH": 3, "g7b:ENG": 3, "g7b:SCI": 4, "g8b:MTH": 4, "g6r:MTH": 4, "g9:MTH": 4, "g10:MTH": 4 };

const pad = (n) => String(n).padStart(2, "0");
const ymd = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;

function datesForWeekday(month, weekday) {
  const out = [];
  const d = new Date(`${month}-01T00:00:00Z`);
  while (d.toISOString().startsWith(month)) {
    if (WEEKDAYS[d.getUTCDay()] === weekday) out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthLabel = (month) => `${MONTH_NAMES[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;

module.exports = {
  async up(queryInterface) {
    const qi = queryInterface;
    const [[found]] = await qi.sequelize.query(`SELECT id FROM schools WHERE email = :email LIMIT 1`, {
      replacements: { email: SCHOOL_EMAIL },
    });
    if (found) {
      console.log("Creative Leaders demo already present; run db:seed:undo:all first to reset it.");
      return;
    }

    await qi.sequelize.transaction(async (transaction) => {
      const now = new Date();
      const stamp = (row) => ({ created_at: now, updated_at: now, ...row });
      const insert = async (table, rows) => {
        if (!rows.length) return [];
        return qi.bulkInsert(table, rows.map(stamp), { transaction, returning: true });
      };
      const password = await bcrypt.hash("password", 10);

      // 1. School
      const [school] = await insert("schools", [
        {
          school_name: "Creative Leaders School",
          phone: "042-111-257257",
          address: "Lahore, Pakistan",
          email: SCHOOL_EMAIL,
          website: "https://creativeleaders.edu.pk",
        },
      ]);
      const schoolId = school.id;
      const withSchool = (row) => ({ fk_school_id: schoolId, ...row });

      // 2. Academic Session
      const [session] = await insert("academic_sessions", [
        withSchool({ name: SESSION.name, start_date: SESSION.start, end_date: SESSION.end, is_current: true }),
      ]);

      // 3. Subjects
      const subjects = await insert("subjects", SUBJECTS.map((s) => withSchool(s)));
      const subjectBy = Object.fromEntries(subjects.map((s) => [s.code, s]));

      // 4. Classes (KG to Grade 10)
      const classes = await insert(
        "classes",
        CLASSES.map((c) => withSchool({
          fk_session_id: session.id,
          grade: c.grade,
          section: c.section,
          label: `${c.grade} ${c.section}`,
          room: c.room,
          period_count: c.periods,
          monthly_fee: c.fee,
        })),
      );
      const classBy = Object.fromEntries(CLASSES.map((c, i) => [c.key, { ...classes[i], ...c }]));

      // 5. Staff Users: Super Admins (3), Operations Managers (3), Accountants (3), Teachers (12)
      const staffUsers = await insert(
        "users",
        [...OPERATIONAL_STAFF, ...TEACHER_STAFF].map((u) => withSchool({
          first_name: u.first,
          last_name: u.last,
          email: u.email,
          password,
          gender: u.gender,
          role: u.role,
          status: "active",
        })),
      );
      const userBy = Object.fromEntries(staffUsers.map((u) => [u.email, u]));
      const admin = userBy["admin@cls.edu.pk"];
      const ops = userBy["operations@cls.edu.pk"];
      const accountant = userBy["accountant@cls.edu.pk"];
      const rashidAcc = userBy["rashid.acc@cls.edu.pk"];
      const hamzaAcc = userBy["hamza.acc@cls.edu.pk"];

      // 6. Teachers table + subject history
      const teachers = await insert(
        "teachers",
        TEACHER_STAFF.map((t) => withSchool({
          fk_user_id: userBy[t.email].id,
          employee_code: t.code,
          fk_subject_id: subjectBy[t.subject].id,
        })),
      );
      const teacherByCode = Object.fromEntries(TEACHER_STAFF.map((t, i) => [t.code, { ...teachers[i], name: `${t.first} ${t.last}`, subjectCode: t.subject }]));
      const teacherBySubject = Object.fromEntries(TEACHER_STAFF.slice(0, 8).map((t, i) => [t.subject, { ...teachers[i], name: `${t.first} ${t.last}` }]));

      await insert(
        "teacher_subject_assignments",
        TEACHER_STAFF.map((t, i) => withSchool({
          fk_teacher_id: teachers[i].id,
          fk_subject_id: subjectBy[t.subject].id,
          effective_from: SESSION.start,
          fk_assigned_by_user_id: ops.id,
          reason: "Session 2026–27 allocation",
        })),
      );

      // 7. Timetable slots (Conflict-free across all 11 classes, 5 days, periods)
      const slots = [];
      CLASSES.forEach((c, classIndex) => {
        SCHOOL_DAYS.forEach((day, dayIndex) => {
          for (let p = 1; p <= c.periods; p += 1) {
            // Formula guarantees each teacher teaches at most 1 class at any (day, period)
            const teacherIdx = (classIndex + (p - 1) + dayIndex) % TEACHER_STAFF.length;
            const staffObj = TEACHER_STAFF[teacherIdx];
            const teacherObj = teacherByCode[staffObj.code];
            const subjectObj = subjectBy[staffObj.subject];
            slots.push(withSchool({
              fk_class_id: classBy[c.key].id,
              day,
              time: PERIOD_TIMES[p - 1] || "13:40",
              period_index: p,
              subject: subjectObj.name,
              fk_subject_id: subjectObj.id,
              teacher: teacherObj.name,
              fk_teacher_id: teacherObj.id,
              room: c.room,
            }));
          }
        });
      });
      const slotRows = await insert("timetable_slots", slots);
      const teacherClassPairs = new Set(slotRows.map((s) => `${s.fk_teacher_id}:${s.fk_class_id}`));
      await insert(
        "teacher_classes",
        [...teacherClassPairs].map((pair) => {
          const [fkTeacherId, fkClassId] = pair.split(":").map(Number);
          return { fk_teacher_id: fkTeacherId, fk_class_id: fkClassId };
        }),
      );

      // 8. Build 50 students per class across 11 classes = 550 students
      // Key demo students required by test flows:
      const DEMO_STUDENT_SPECS = {
        g7b: [
          { key: "rayan", no: "CLS-24118", first: "Rayan", last: "Ahmed", gender: "Male", parentEmail: "parent@cls.edu.pk" },
          { key: "ayaan", no: "CLS-24122", first: "Ayaan", last: "Butt", gender: "Male", parentEmail: "kamran@cls.edu.pk", admitted: "2026-01-05" },
          { key: "hira", no: "CLS-24125", first: "Hira", last: "Siddiqui", gender: "Female", parentEmail: "family.1@cls.edu.pk" },
          { key: "daniyal", no: "CLS-24131", first: "Daniyal", last: "Khan", gender: "Male", parentEmail: "farhan.q@cls.edu.pk" },
        ],
        g8b: [
          { key: "maham", no: "CLS-23107", first: "Maham", last: "Tariq", gender: "Female", parentEmail: "family.2@cls.edu.pk" },
          { key: "usman", no: "CLS-23112", first: "Usman", last: "Javed", gender: "Male", parentEmail: "family.3@cls.edu.pk" },
        ],
        g6r: [
          { key: "zara", no: "CLS-25103", first: "Zara", last: "Ahmed", gender: "Female", parentEmail: "parent@cls.edu.pk" },
          { key: "ali", no: "CLS-25109", first: "Ali", last: "Raza", gender: "Male", parentEmail: "family.4@cls.edu.pk" },
        ],
      };

      // Generate pool of family parent accounts (realistic shared siblings)
      const familyParents = [
        { email: "parent@cls.edu.pk", first: "Sara", last: "Ahmed", gender: "Female" },
        { email: "kamran@cls.edu.pk", first: "Kamran", last: "Butt", gender: "Male" },
        { email: "farhan.q@cls.edu.pk", first: "Farhan", last: "Qureshi", gender: "Male" },
      ];
      for (let i = 1; i <= 220; i += 1) {
        const isMale = i % 2 === 1;
        const fn = isMale ? FIRST_NAMES_MALE[(i * 3) % FIRST_NAMES_MALE.length] : FIRST_NAMES_FEMALE[(i * 3) % FIRST_NAMES_FEMALE.length];
        const ln = LAST_NAMES[(i * 7) % LAST_NAMES.length];
        familyParents.push({
          email: `family.${i}@cls.edu.pk`,
          first: fn,
          last: ln,
          gender: isMale ? "Male" : "Female",
        });
      }

      const parentUsers = await insert(
        "users",
        familyParents.map((p) => withSchool({
          first_name: p.first,
          last_name: p.last,
          email: p.email,
          password,
          gender: p.gender,
          role: "parent",
          status: "active",
        })),
      );
      const parentUserBy = Object.fromEntries(parentUsers.map((u) => [u.email, u]));

      const parents = await insert(
        "parents",
        parentUsers.map((u) => withSchool({ fk_user_id: u.id, relation: "Guardian" })),
      );
      const parentRecordByEmail = Object.fromEntries(familyParents.map((p, i) => [p.email, parents[i]]));

      // Build student records (50 per class)
      const studentSpecs = [];
      let studentSeq = 1;
      CLASSES.forEach((cls, classIdx) => {
        const demoList = DEMO_STUDENT_SPECS[cls.key] || [];
        demoList.forEach((demo) => {
          studentSpecs.push({
            key: demo.key,
            no: demo.no,
            first: demo.first,
            last: demo.last,
            gender: demo.gender,
            class: cls.key,
            parentEmail: demo.parentEmail,
            admitted: demo.admitted || SESSION.start,
          });
        });

        const remaining = 50 - demoList.length;
        for (let i = 1; i <= remaining; i += 1) {
          studentSeq += 1;
          const isBoy = (classIdx + i) % 2 === 0;
          const first = isBoy ? FIRST_NAMES_MALE[(classIdx * 7 + i) % FIRST_NAMES_MALE.length] : FIRST_NAMES_FEMALE[(classIdx * 7 + i) % FIRST_NAMES_FEMALE.length];
          const last = LAST_NAMES[(classIdx * 5 + i) % LAST_NAMES.length];
          // Share parents across classes so ~2 students share a parent on average
          const parentIdx = (classIdx * 19 + i) % familyParents.length;
          const pEmail = familyParents[parentIdx].email;
          const admNo = `CLS-${cls.grade.replace(/\s+/g, "").toUpperCase()}-${pad(i + demoList.length)}`;

          studentSpecs.push({
            key: `s_${cls.key}_${i}`,
            no: admNo,
            first,
            last,
            gender: isBoy ? "Male" : "Female",
            class: cls.key,
            parentEmail: pEmail,
            admitted: SESSION.start,
          });
        }
      });

      const studentRows = await insert(
        "students",
        studentSpecs.map((s) => withSchool({
          fk_class_id: classBy[s.class].id,
          admission_no: s.no,
          first_name: s.first,
          last_name: s.last,
          gender: s.gender,
          status: "Active",
          admitted_on: s.admitted,
        })),
      );
      const studentBy = Object.fromEntries(studentSpecs.map((s, i) => [s.key, { ...studentRows[i], ...s }]));

      // 9. Link students to parents (student_parents)
      await insert(
        "student_parents",
        studentSpecs.map((s) => ({
          fk_student_id: studentBy[s.key].id,
          fk_parent_id: (parentRecordByEmail[s.parentEmail] || parents[0]).id,
          is_primary: true,
        })),
      );

      // 10. School settings
      await insert("school_settings", Object.entries(SETTING_DEFAULTS).map(([key, value]) => withSchool({
        key,
        value: JSON.stringify(key === "fees" ? { ...value, defaultMonthlyFee: 8500 } : value),
        fk_updated_by_user_id: admin.id,
      })));

      // 11. Fees Ledger & Payments
      const audit = [];
      const auditRow = (actor, action, entityType, entityId, metadata, at = now) =>
        audit.push(withSchool({
          actor_user_id: actor.id,
          actor_label: `${actor.email} (${actor.role})`,
          action,
          entity_type: entityType,
          entity_id: entityId,
          metadata: JSON.stringify(metadata || {}),
          at,
        }));

      const months = [];
      const monthsFor = (s) => {
        const start = Number((s.admitted || SESSION.start).slice(5, 7));
        const list = [];
        for (let m = start; m <= 9; m += 1) list.push(ymd(2026, m, 1));
        if (s.key === "rayan") list.push("2026-10-01");
        return list;
      };

      for (const s of Object.values(studentBy)) {
        for (const month of monthsFor(s)) {
          months.push(withSchool({
            fk_student_id: s.id,
            month,
            fee_type: "Tuition",
            amount_due: classBy[s.class].fee,
            amount_paid: 0,
            status: "Unpaid",
            due_date: `${month.slice(0, 8)}10`,
          }));
        }
      }
      const monthRows = await insert("student_fee_months", months);
      const ledger = new Map(monthRows.map((m) => [`${m.fk_student_id}:${m.month}`, { ...m, paid: 0 }]));

      // Core payment plan
      const monthly = (from, to, fee, day = 5, recorder = accountant) =>
        Array.from({ length: to - from + 1 }, (_, i) => [ymd(2026, from + i, day), fee, recorder]);

      const plan = {
        rayan: [...monthly(4, 8, 8500), [DEMO_DAY, 17000, accountant]],
        hira: [...monthly(4, 8, 8500), [DEMO_DAY, 8500, accountant]],
        daniyal: [...monthly(4, 7, 8500), ["2026-08-06", 5000, accountant]],
        maham: [...monthly(4, 8, 9000), [DEMO_DAY, 9000, rashidAcc]],
        usman: [...monthly(4, 8, 9000), [DEMO_DAY, 9000, hamzaAcc]],
        zara: monthly(4, 8, 8000),
        ali: [...monthly(4, 8, 8000), [DEMO_DAY, 8000, admin]],
        ayaan: monthly(1, 6, 8500),
      };

      // Add payments for several other students across grades
      const sampleStudents = Object.values(studentBy).slice(8, 60);
      sampleStudents.forEach((st, idx) => {
        const recorder = idx % 3 === 0 ? accountant : idx % 3 === 1 ? rashidAcc : hamzaAcc;
        const fee = classBy[st.class].fee;
        plan[st.key] = [...monthly(4, 7, fee, 5 + (idx % 20), recorder), [DEMO_DAY, fee, recorder]];
      });

      let receiptSeq = 0;
      const allocations = [];
      for (const [key, payments] of Object.entries(plan)) {
        const s = studentBy[key];
        if (!s) continue;
        const open = monthRows.filter((m) => m.fk_student_id === s.id).sort((a, b) => a.month.localeCompare(b.month));
        for (const [date, amount, recorder] of payments) {
          receiptSeq += 1;
          let remaining = amount;
          const lines = [];
          for (const m of open) {
            const entry = ledger.get(`${s.id}:${m.month}`);
            if (!entry) continue;
            const balance = Number(entry.amount_due) - entry.paid;
            if (remaining <= 0 || balance <= 0) continue;
            const take = Math.min(balance, remaining);
            entry.paid += take;
            remaining -= take;
            lines.push({ entry, take });
          }
          const [payment] = await insert("fee_payments", [withSchool({
            ref: `RCPT-${date.replace(/-/g, "")}-${pad(receiptSeq).padStart(4, "0")}`,
            fk_student_id: s.id,
            period: lines.map((l) => monthLabel(l.entry.month)).join(", "),
            type: "Tuition",
            amount,
            method: "Cash",
            status: "Paid",
            paid_on: date,
            fk_recorded_by_user_id: recorder.id,
            unallocated_amount: remaining,
            allocation_mode: "auto",
            idempotency_key: `IDEM-PAY-${s.id}-${date}-${receiptSeq}`,
          })]);
          for (const l of lines) allocations.push(withSchool({ fk_payment_id: payment.id, fk_fee_month_id: l.entry.id, amount: l.take }));
          auditRow(recorder, `allocated receipt ${payment.ref} (oldest first) to ${payment.period}`, "fee_payment", payment.id, {
            studentId: s.id,
            mode: "auto",
            lines: lines.map((l) => ({ feeMonthId: l.entry.id, amount: l.take })),
          }, new Date(`${date}T10:00:00+05:00`));
        }
      }
      await insert("fee_allocations", allocations);

      // Batch update updated student fee months
      for (const entry of ledger.values()) {
        if (!entry.paid) continue;
        const due = Number(entry.amount_due);
        const status = entry.paid < due ? "Partially Paid" : entry.month > "2026-09-01" ? "Advance" : "Paid";
        await qi.bulkUpdate("student_fee_months", { amount_paid: entry.paid, status }, { id: entry.id }, { transaction });
      }

      // 12. Substitutes: Hassan absent on Tue 29 Sep 2026
      const weekday = WEEKDAYS[new Date(`${DEMO_DAY}T00:00:00Z`).getUTCDay()];
      const hassan = teacherBySubject.MTH;
      const hassanSlots = slotRows.filter((s) => s.fk_teacher_id === hassan.id && s.day === weekday).sort((a, b) => a.period_index - b.period_index);
      const absences = await insert("teacher_absences", hassanSlots.map((slot) => withSchool({
        fk_teacher_id: hassan.id,
        fk_class_id: slot.fk_class_id,
        fk_subject_id: slot.fk_subject_id,
        fk_timetable_slot_id: slot.id,
        date: DEMO_DAY,
        period_index: slot.period_index,
        status: "Pending",
        fk_marked_by_user_id: ops.id,
        notes: "Medical leave",
      })));
      const covered = absences[1] || absences[0];
      const busy = new Set(slotRows.filter((s) => s.day === weekday && s.period_index === covered.period_index).map((s) => s.fk_teacher_id));
      const substitute = Object.values(teacherBySubject).find((t) => !busy.has(t.id)) || teachers[1];
      const [assignment] = await insert("substitute_assignments", [withSchool({
        fk_absence_id: covered.id,
        fk_timetable_slot_id: covered.fk_timetable_slot_id,
        date: DEMO_DAY,
        period_index: covered.period_index,
        fk_class_id: covered.fk_class_id,
        fk_subject_id: covered.fk_subject_id,
        fk_original_teacher_id: hassan.id,
        fk_substitute_teacher_id: substitute.id,
        fk_authorized_by_user_id: ops.id,
        notes: "Revise the current chapter; worksheet on the desk",
      })]);
      await qi.bulkUpdate("teacher_absences", { status: "Covered" }, { id: covered.id }, { transaction });
      auditRow(ops, `marked teacher #${hassan.id} absent on ${DEMO_DAY}`, "teacher", hassan.id, { date: DEMO_DAY, periods: hassanSlots.map((s) => s.period_index) });
      auditRow(ops, `assigned ${substitute.name} to cover period ${covered.period_index} on ${DEMO_DAY}`, "substitute_assignment", assignment.id, {
        absenceId: covered.id,
        originalTeacherId: hassan.id,
        substituteTeacherId: substitute.id,
      });

      // 13. Planned chapters & Daily lessons
      const chapterRows = await insert("planned_chapters", Object.entries(CHAPTERS).flatMap(([key, titles]) => {
        const [classKey, code] = key.split(":");
        return titles.map((title, i) => withSchool({
          fk_class_id: classBy[classKey].id,
          fk_subject_id: subjectBy[code].id,
          sequence: i + 1,
          title,
          target_date: ymd(2026, 9 + Math.floor(i / 2), i % 2 ? 25 : 10),
          fk_created_by_user_id: ops.id,
        }));
      }));
      const chapter = (classKey, code, seq) =>
        chapterRows.find((c) => c.fk_class_id === classBy[classKey].id && c.fk_subject_id === subjectBy[code].id && c.sequence === seq);
      const teacherUser = (code) => userBy[TEACHER_STAFF.find((t) => t.subject === code).email];
      const lesson = (classKey, code, seq, date, review, extra = {}) => {
        const c = chapter(classKey, code, seq);
        return withSchool({
          fk_class_id: classBy[classKey].id,
          fk_subject_id: subjectBy[code].id,
          fk_teacher_id: teacherBySubject[code].id,
          fk_planned_chapter_id: c ? c.id : null,
          chapter: c ? c.title : "Introduction",
          date,
          classwork: extra.classwork || null,
          homework: extra.homework || null,
          remarks: extra.remarks || null,
          progress: extra.progress || 50,
          status: "In progress",
          review_status: review,
          fk_submitted_by_user_id: teacherUser(code).id,
          fk_reviewed_by_user_id: review === "Submitted" ? null : ops.id,
          reviewed_at: review === "Submitted" ? null : now,
          review_note: extra.note || null,
        });
      };
      await insert("daily_lessons", [
        lesson("g7b", "MTH", 3, "2026-09-25", "Approved", { classwork: "Like and unlike terms, Ex 3.1 Q1–6", homework: "Ex 3.1 Q7–12", progress: 40 }),
        lesson("g7b", "MTH", 3, "2026-09-28", "Submitted", { classwork: "Adding and subtracting expressions", homework: "Worksheet 3B", progress: 65 }),
        lesson("g7b", "ENG", 2, "2026-09-28", "Approved", { classwork: "Past continuous in a story", homework: "Write 10 sentences", progress: 55 }),
        lesson("g7b", "SCI", 2, "2026-09-28", "Rejected", { classwork: "Photosynthesis", note: "Please add the homework set in class." }),
      ]);

      // 14. Weekly subject tests
      const scheduleRows = [];
      for (const sch of TEST_SCHEDULES) {
        const slot = slotRows.find((s) => s.fk_class_id === classBy[sch.class].id && s.fk_subject_id === subjectBy[sch.subject].id && s.day === sch.weekday);
        const [row] = await insert("daily_test_schedules", [withSchool({
          fk_class_id: classBy[sch.class].id,
          fk_subject_id: subjectBy[sch.subject].id,
          weekday: sch.weekday,
          period_index: slot ? slot.period_index : null,
          max_score: 20,
          is_active: true,
          fk_created_by_user_id: ops.id,
        })]);
        scheduleRows.push({ ...row, ...sch });
      }

      const summaries = [];
      for (const sch of scheduleRows) {
        const key = `${sch.class}:${sch.subject}`;
        const dates = datesForWeekday("2026-09", sch.weekday);
        const teacher = teacherBySubject[sch.subject] || teachers[0];
        const publishedCount = PUBLISHED_WEEKS[key] || 3;
        const tests = await insert("daily_tests", dates.map((date, i) => {
          const hasMarks = i < 4;
          const published = i < publishedCount;
          return withSchool({
            fk_schedule_id: sch.id,
            fk_class_id: sch.fk_class_id,
            fk_subject_id: sch.fk_subject_id,
            fk_teacher_id: teacher.id,
            date,
            month: "2026-09",
            week_of_month: Math.floor((Number(date.slice(8)) - 1) / 7) + 1,
            period_index: sch.period_index,
            title: `${SUBJECTS.find((s) => s.code === sch.subject).name} weekly test · week ${i + 1}`,
            max_score: 20,
            status: published ? "Published" : hasMarks ? "MarksEntered" : "Scheduled",
            published_at: published ? new Date(`${date}T15:00:00+05:00`) : null,
            fk_published_by_user_id: published ? ops.id : null,
          });
        }));

        const results = [];
        const scoreTable = DEMO_TEST_SCORES[key] || {};
        for (const [studentKey, scores] of Object.entries(scoreTable)) {
          const targetStudent = studentBy[studentKey];
          if (!targetStudent) continue;
          scores.forEach((score, i) => {
            if (tests[i]) results.push({ fk_daily_test_id: tests[i].id, fk_student_id: targetStudent.id, score, fk_entered_by_user_id: teacherUser(sch.subject).id });
          });
          const outcome = summarizeMonth(scores.map((score) => ({ score, maxScore: 20 })), tests.length, SETTING_DEFAULTS.dailyTestRules);
          summaries.push(withSchool({
            fk_class_id: sch.fk_class_id,
            fk_subject_id: sch.fk_subject_id,
            fk_student_id: targetStudent.id,
            month: "2026-09",
            tests_scheduled: outcome.testsScheduled,
            tests_taken: outcome.testsTaken,
            passed_count: outcome.passedCount,
            failed_count: outcome.failedCount,
            average_percent: outcome.averagePercent,
            status: outcome.status,
            flagged_for_follow_up: outcome.flaggedForFollowUp,
          }));
        }
        await insert("daily_test_results", results);
      }
      const summaryRows = await insert("monthly_student_summaries", summaries);
      for (const row of summaryRows.filter((r) => r.status === "Failed" || r.status === "LowMarks")) {
        const sub = SUBJECTS.find((s) => subjectBy[s.code].id === row.fk_subject_id);
        auditRow(teacherUser(sub.code), `weekly-test outcome for student #${row.fk_student_id} (2026-09) is ${row.status}`, "monthly_student_summary", row.id, {
          from: null,
          status: row.status,
          failedCount: row.failed_count,
          averagePercent: row.average_percent,
        });
      }

      // 15. Exams & Mark sheets
      const exams = await insert("exams", [
        withSchool({ fk_session_id: session.id, fk_class_id: classBy.g7b.id, name: "September Monthly Assessment", fee_month: "2026-09" }),
        withSchool({ fk_session_id: session.id, fk_class_id: classBy.g6r.id, name: "September Monthly Assessment", fee_month: "2026-09" }),
      ]);
      const sheetSpecs = [
        { exam: exams[0], class: "g7b", code: "MTH", status: "Published", scores: { rayan: 86, ayaan: 58, hira: 64, daniyal: 71 } },
        { exam: exams[0], class: "g7b", code: "ENG", status: "Published", scores: { rayan: 79, ayaan: 62, hira: 75, daniyal: 68 } },
        { exam: exams[0], class: "g7b", code: "SCI", status: "Verified", scores: { rayan: 88, ayaan: 55, hira: 70, daniyal: 74 } },
        { exam: exams[1], class: "g6r", code: "MTH", status: "Published", scores: { zara: 91, ali: 77 } },
      ];
      for (const spec of sheetSpecs) {
        const [sheet] = await insert("mark_sheets", [withSchool({
          fk_exam_id: spec.exam.id,
          exam_name: spec.exam.name,
          fk_class_id: classBy[spec.class].id,
          fk_subject_id: subjectBy[spec.code].id,
          subject: SUBJECTS.find((s) => s.code === spec.code).name,
          fk_teacher_id: teacherBySubject[spec.code].id,
          status: spec.status,
          max_score: 100,
          pass_percent: 40,
          published_at: spec.status === "Published" ? new Date("2026-09-27T12:00:00+05:00") : null,
          fk_published_by_user_id: spec.status === "Published" ? ops.id : null,
        })]);
        await insert("mark_sheet_rows", Object.entries(spec.scores).map(([key, score]) => ({ fk_mark_sheet_id: sheet.id, fk_student_id: studentBy[key].id, score })));
      }
      const [override] = await insert("result_visibility_overrides", [withSchool({
        fk_exam_id: exams[0].id,
        fk_student_id: studentBy.daniyal.id,
        reason: "Principal approved release: August balance under scholarship review.",
        fk_granted_by_user_id: ops.id,
        granted_at: new Date("2026-09-28T09:30:00+05:00"),
      })]);
      auditRow(ops, "released September Monthly Assessment result for Daniyal Khan despite fees", "result_visibility_override", override.id, {
        examId: exams[0].id,
        studentId: studentBy.daniyal.id,
        reason: override.reason,
      }, override.granted_at);

      // 16. Attendances for all students on demo dates
      const attendances = [];
      const attendanceDates = ["2026-09-28", "2026-09-29"];
      attendanceDates.forEach((date) => {
        Object.values(studentBy).forEach((s, idx) => {
          let status = "Present";
          if (s.key === "ayaan" && date === "2026-09-28") status = "Absent";
          else if (idx % 23 === 0) status = "Absent";
          else if (idx % 37 === 0) status = "Leave";

          attendances.push({
            fk_student_id: s.id,
            fk_class_id: classBy[s.class].id,
            date,
            status,
          });
        });
      });
      await insert("attendances", attendances);

      // 17. Applications & application documents
      const applications = await insert("applications", [
        withSchool({ name: "Mustafa Iqbal", fk_class_id: classBy.g6r.id, guardian: "Asif Iqbal", phone: "0300-4441122", status: "Review", submitted_on: "2026-09-20", decision: null }),
        withSchool({ name: "Anaya Qureshi", fk_class_id: classBy.g7b.id, guardian: "Sana Qureshi", phone: "0321-7778899", status: "New", submitted_on: "2026-09-26", decision: null }),
        withSchool({ name: "Zohaib Hassan", fk_class_id: classBy.kg.id, guardian: "Hassan Raza", phone: "0333-5556677", status: "Enrolled", submitted_on: "2026-09-10", decision: "Admit" }),
        withSchool({ name: "Hamna Tariq", fk_class_id: classBy.g1.id, guardian: "Tariq Mehmood", phone: "0345-8889900", status: "Waitlist", submitted_on: "2026-09-15", decision: "Waitlist" }),
        withSchool({ name: "Rehan Shah", fk_class_id: classBy.g9.id, guardian: "Shahid Shah", phone: "0312-3334455", status: "Rejected", submitted_on: "2026-09-08", decision: "Reject" }),
      ]);

      await insert("application_documents", [
        { fk_application_id: applications[0].id, label: "CNIC Copy", status: "Verified" },
        { fk_application_id: applications[0].id, label: "Birth Certificate", status: "Verified" },
        { fk_application_id: applications[1].id, label: "Previous School Leaving Certificate", status: "Pending" },
        { fk_application_id: applications[1].id, label: "Birth Certificate", status: "Uploaded" },
        { fk_application_id: applications[2].id, label: "Birth Certificate", status: "Verified" },
        { fk_application_id: applications[2].id, label: "Immunization Record", status: "Verified" },
        { fk_application_id: applications[3].id, label: "Birth Certificate", status: "Verified" },
        { fk_application_id: applications[4].id, label: "Previous Academic Transcript", status: "Verified" },
      ]);

      // 18. Operational expenses
      await insert("expenses", [
        withSchool({ title: "September staff payroll", category: "Payroll", amount: 640000, date: "2026-09-25" }),
        withSchool({ title: "Science lab consumables", category: "Academic supplies", amount: 38500, date: "2026-09-12" }),
        withSchool({ title: "Campus utility bills (Electricity & Water)", category: "Utilities", amount: 85000, date: "2026-09-18" }),
        withSchool({ title: "Facilities maintenance and repairs", category: "Maintenance", amount: 42000, date: "2026-09-15" }),
        withSchool({ title: "Library books and journals", category: "Library", amount: 18000, date: "2026-09-05" }),
        withSchool({ title: "Sports equipment and field gear", category: "Sports", amount: 22500, date: "2026-09-08" }),
        withSchool({ title: "Educational software licenses", category: "Software", amount: 15000, date: "2026-09-02" }),
      ]);

      // 19. Audit logs
      await insert("audit_logs", audit);
    });
  },

  async down(queryInterface) {
    const qi = queryInterface;
    const [[school]] = await qi.sequelize.query(`SELECT id FROM schools WHERE email = :email LIMIT 1`, {
      replacements: { email: SCHOOL_EMAIL },
    });
    if (!school) return;
    const q = (sql, transaction) => qi.sequelize.query(sql, { replacements: { id: school.id }, transaction });
    const bySchool = [
      "audit_logs", "school_settings", "fee_allocations", "fee_payments", "student_fee_months",
      "result_visibility_overrides",
    ];
    const bySchoolLate = [
      "mark_sheets", "exams", "monthly_student_summaries", "daily_tests", "daily_test_schedules", "daily_lessons",
      "planned_chapters", "substitute_assignments", "teacher_absences", "timetable_slots",
    ];
    await qi.sequelize.transaction(async (t) => {
      for (const table of bySchool) await q(`DELETE FROM ${table} WHERE fk_school_id = :id`, t);
      await q(`DELETE FROM mark_sheet_rows WHERE fk_mark_sheet_id IN (SELECT id FROM mark_sheets WHERE fk_school_id = :id)`, t);
      await q(`DELETE FROM daily_test_results WHERE fk_daily_test_id IN (SELECT id FROM daily_tests WHERE fk_school_id = :id)`, t);
      for (const table of bySchoolLate) await q(`DELETE FROM ${table} WHERE fk_school_id = :id`, t);
      await q(`DELETE FROM attendances WHERE fk_student_id IN (SELECT id FROM students WHERE fk_school_id = :id)`, t);
      await q(`DELETE FROM student_parents WHERE fk_student_id IN (SELECT id FROM students WHERE fk_school_id = :id)`, t);
      await q(`DELETE FROM application_documents WHERE fk_application_id IN (SELECT id FROM applications WHERE fk_school_id = :id)`, t);
      for (const table of ["parents", "applications", "expenses", "teacher_subject_assignments"]) {
        await q(`DELETE FROM ${table} WHERE fk_school_id = :id`, t);
      }
      await q(`DELETE FROM teacher_classes WHERE fk_teacher_id IN (SELECT id FROM teachers WHERE fk_school_id = :id)`, t);
      for (const table of ["teachers", "students", "classes", "subjects", "academic_sessions", "users"]) {
        await q(`DELETE FROM ${table} WHERE fk_school_id = :id`, t);
      }
      await q(`DELETE FROM schools WHERE id = :id`, t);
    });
  },
};
