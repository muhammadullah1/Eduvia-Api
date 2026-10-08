"use strict";

const bcrypt = require("bcryptjs");

/**
 * Creative Leaders School data for the live schema (migrations 001–036).
 * Password for every account is `password`.
 *
 * Covers the SRS scenarios the current tables can store:
 * Rayan paid through October, Ayaan with three unpaid months, Daniyal partially paid,
 * Zara unpaid for September and linked to the same parent as Rayan, Hassan absent
 * on 8 Oct 2026 with one substitute cover, and an exam result override for Daniyal.
 */

const SCHOOL_EMAIL = "admin@cls.edu.pk";
const SESSION = { name: "2026–27", start: "2026-04-01", end: "2027-03-31" };
const PERIOD_START = ["08:00", "08:40", "09:20", "10:00", "10:40", "11:20", "12:00", "12:40"];
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

const STAFF = [
  { email: "admin@cls.edu.pk", first: "Ayesha", last: "Khan", role: "super_admin", gender: "Female", phone: "0300-1000001" },
  { email: "tariq.admin@cls.edu.pk", first: "Tariq", last: "Mehmood", role: "super_admin", gender: "Male", phone: "0300-1000002" },
  { email: "operations@cls.edu.pk", first: "Imran", last: "Shah", role: "operations_manager", gender: "Male", phone: "0300-2000001" },
  { email: "sana.ops@cls.edu.pk", first: "Sana", last: "Farooq", role: "operations_manager", gender: "Female", phone: "0300-2000002" },
  { email: "accountant@cls.edu.pk", first: "Nadia", last: "Iqbal", role: "accountant", gender: "Female", phone: "0300-3000001" },
  { email: "rashid.acc@cls.edu.pk", first: "Rashid", last: "Minhas", role: "accountant", gender: "Male", phone: "0300-3000002" },
];

const TEACHERS = [
  { email: "hassan@cls.edu.pk", first: "Hassan", last: "Ali", gender: "Male", subject: "MTH", code: "T-101", phone: "0301-1010101" },
  { email: "fatima@cls.edu.pk", first: "Fatima", last: "Noor", gender: "Female", subject: "ENG", code: "T-102", phone: "0301-1010102" },
  { email: "bilal@cls.edu.pk", first: "Bilal", last: "Raza", gender: "Male", subject: "SCI", code: "T-103", phone: "0301-1010103" },
  { email: "zainab@cls.edu.pk", first: "Zainab", last: "Malik", gender: "Female", subject: "URD", code: "T-104", phone: "0301-1010104" },
  { email: "omar@cls.edu.pk", first: "Omar", last: "Farooq", gender: "Male", subject: "CS", code: "T-105", phone: "0301-1010105" },
  { email: "aisha.t@cls.edu.pk", first: "Aisha", last: "Siddiqui", gender: "Female", subject: "ISL", code: "T-106", phone: "0301-1010106" },
  { email: "usman.t@cls.edu.pk", first: "Usman", last: "Tariq", gender: "Male", subject: "SST", code: "T-107", phone: "0301-1010107" },
  { email: "hira.t@cls.edu.pk", first: "Hira", last: "Jamil", gender: "Female", subject: "ART", code: "T-108", phone: "0301-1010108" },
];

const CLASSES = [
  { key: "kg", grade: "KG", section: "Green", room: "K-01", periods: 6, fee: 7000 },
  { key: "g6r", grade: "Grade 6", section: "Red", room: "B-03", periods: 7, fee: 8000 },
  { key: "g7b", grade: "Grade 7", section: "Blue", room: "B-12", periods: 8, fee: 8500 },
  { key: "g8b", grade: "Grade 8", section: "Blue", room: "B-14", periods: 8, fee: 9000 },
  { key: "g9", grade: "Grade 9", section: "Blue", room: "C-01", periods: 8, fee: 9500 },
  { key: "g10", grade: "Grade 10", section: "Blue", room: "C-02", periods: 8, fee: 10000 },
];

const PARENTS = [
  { email: "parent@cls.edu.pk", first: "Sara", last: "Ahmed", gender: "Female", phone: "0321-1112233" },
  { email: "kamran@cls.edu.pk", first: "Kamran", last: "Butt", gender: "Male", phone: "0321-2223344" },
  { email: "farhan.q@cls.edu.pk", first: "Farhan", last: "Qureshi", gender: "Male", phone: "0321-3334455" },
  { email: "family.1@cls.edu.pk", first: "Hina", last: "Siddiqui", gender: "Female", phone: "0321-4445566" },
  { email: "family.2@cls.edu.pk", first: "Tariq", last: "Javed", gender: "Male", phone: "0321-5556677" },
  { email: "family.3@cls.edu.pk", first: "Nadia", last: "Raza", gender: "Female", phone: "0321-6667788" },
];

const NAMED_STUDENTS = [
  { key: "rayan", no: "CLS-24118", first: "Rayan", last: "Ahmed", gender: "Male", class: "g7b", parent: "parent@cls.edu.pk", dob: "2014-03-12", admitted: "2026-04-01" },
  { key: "ayaan", no: "CLS-24122", first: "Ayaan", last: "Butt", gender: "Male", class: "g7b", parent: "kamran@cls.edu.pk", dob: "2014-07-02", admitted: "2026-01-05" },
  { key: "hira", no: "CLS-24125", first: "Hira", last: "Siddiqui", gender: "Female", class: "g7b", parent: "family.1@cls.edu.pk", dob: "2014-11-19", admitted: "2026-04-01" },
  { key: "daniyal", no: "CLS-24131", first: "Daniyal", last: "Khan", gender: "Male", class: "g7b", parent: "farhan.q@cls.edu.pk", dob: "2014-01-28", admitted: "2026-04-01" },
  { key: "zara", no: "CLS-25103", first: "Zara", last: "Ahmed", gender: "Female", class: "g6r", parent: "parent@cls.edu.pk", dob: "2015-05-09", admitted: "2026-04-01" },
  { key: "ali", no: "CLS-25109", first: "Ali", last: "Raza", gender: "Male", class: "g6r", parent: "family.3@cls.edu.pk", dob: "2015-02-14", admitted: "2026-04-01" },
  { key: "maham", no: "CLS-23107", first: "Maham", last: "Tariq", gender: "Female", class: "g8b", parent: "family.2@cls.edu.pk", dob: "2013-09-21", admitted: "2026-04-01" },
  { key: "usman", no: "CLS-23112", first: "Usman", last: "Javed", gender: "Male", class: "g8b", parent: "family.2@cls.edu.pk", dob: "2013-12-03", admitted: "2026-04-01" },
];

const pad = (n) => String(n).padStart(2, "0");
const ymd = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
const monthKey = (y, m) => `${y}-${pad(m)}`;

module.exports = {
  async up(queryInterface) {
    const qi = queryInterface;
    const [[found]] = await qi.sequelize.query(`SELECT id FROM schools WHERE email = :email LIMIT 1`, {
      replacements: { email: SCHOOL_EMAIL },
    });
    if (found) return;

    await qi.sequelize.transaction(async (transaction) => {
      const now = new Date();
      const stamp = (row) => ({ created_at: now, updated_at: now, ...row });
      const insert = async (table, rows) => {
        if (!rows.length) return [];
        return qi.bulkInsert(table, rows.map(stamp), { transaction, returning: true });
      };
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
      const schoolId = school.id;
      const withSchool = (row) => ({ fk_school_id: schoolId, ...row });

      const [session] = await insert("academic_sessions", [
        withSchool({ name: SESSION.name, start_date: SESSION.start, end_date: SESSION.end, is_current: true }),
      ]);

      await insert("school_settings", [withSchool({
        admission_number_prefix: "CLS",
        admission_number_digits: 4,
        academic_year_start_month: 4,
        currency: "PKR",
        tuition_fee_due_day: 10,
        late_fee_fine_amount: 0,
        late_fee_grace_days: 5,
        timezone: "Asia/Karachi",
      })]);

      const subjects = await insert("subjects", SUBJECTS.map((s) => withSchool({ name: s.name, code: s.code, is_active: true })));
      const subjectBy = Object.fromEntries(subjects.map((s) => [s.code, s]));

      const classes = await insert("classes", CLASSES.map((c) => withSchool({
        fk_session_id: session.id,
        grade: c.grade,
        section: c.section,
        label: `${c.grade} ${c.section}`,
        room: c.room,
        period_count: c.periods,
        monthly_tuition_fee: c.fee,
        capacity: 40,
        status: "Active",
      })));
      const classBy = Object.fromEntries(CLASSES.map((c, i) => [c.key, { ...classes[i], ...c }]));

      const staffUsers = await insert("users", STAFF.map((u) => withSchool({
        first_name: u.first, last_name: u.last, email: u.email, phone: u.phone, password, gender: u.gender, role: u.role, status: "active",
      })));
      const teacherUsers = await insert("users", TEACHERS.map((u) => withSchool({
        first_name: u.first, last_name: u.last, email: u.email, phone: u.phone, password, gender: u.gender, role: "teacher", status: "active",
      })));
      const userBy = Object.fromEntries([...staffUsers, ...teacherUsers].map((u) => [u.email, u]));
      const admin = userBy["admin@cls.edu.pk"];
      const ops = userBy["operations@cls.edu.pk"];
      const accountant = userBy["accountant@cls.edu.pk"];

      const teachers = await insert("teachers", TEACHERS.map((t) => withSchool({
        fk_user_id: userBy[t.email].id,
        fk_subject_id: subjectBy[t.subject].id,
        employee_code: t.code,
        qualification: "B.Ed.",
        joining_date: "2024-04-01",
        status: "Active",
      })));
      const teacherByCode = Object.fromEntries(TEACHERS.map((t, i) => [t.code, { ...teachers[i], subject: t.subject, name: `${t.first} ${t.last}` }]));

      await insert("teacher_subject_assignments", TEACHERS.map((t, i) => withSchool({
        fk_teacher_id: teachers[i].id,
        fk_subject_id: subjectBy[t.subject].id,
        effective_from: SESSION.start,
        fk_assigned_by_user_id: ops.id,
        reason: "Session 2026–27 allocation",
      })));

      const slots = [];
      CLASSES.forEach((c, classIndex) => {
        SCHOOL_DAYS.forEach((day, dayIndex) => {
          for (let p = 1; p <= c.periods; p += 1) {
            const teacher = TEACHERS[(classIndex + (p - 1) + dayIndex) % TEACHERS.length];
            const row = teacherByCode[teacher.code];
            const start = PERIOD_START[p - 1];
            const [hh, mm] = start.split(":").map(Number);
            const endMin = hh * 60 + mm + 35;
            const end = `${pad(Math.floor(endMin / 60))}:${pad(endMin % 60)}`;
            slots.push(withSchool({
              fk_class_id: classBy[c.key].id,
              fk_teacher_id: row.id,
              fk_subject_id: subjectBy[teacher.subject].id,
              day_of_week: day,
              period_index: p,
              start_time: start,
              end_time: end,
              room: c.room,
            }));
          }
        });
      });
      const slotRows = await insert("timetable_slots", slots);

      const classSubject = new Map();
      slotRows.forEach((slot) => classSubject.set(`${slot.fk_class_id}:${slot.fk_subject_id}`, slot));
      await insert("class_subjects", [...classSubject.values()].map((slot) => ({
        fk_class_id: slot.fk_class_id,
        fk_subject_id: slot.fk_subject_id,
        periods_per_week: 5,
        is_elective: false,
        created_at: now,
        updated_at: now,
      })));

      const teacherClass = new Map();
      slotRows.forEach((slot) => teacherClass.set(`${slot.fk_teacher_id}:${slot.fk_class_id}`, slot));
      await insert("teacher_classes", [...teacherClass.values()].map((slot, index) => ({
        fk_teacher_id: slot.fk_teacher_id,
        fk_class_id: slot.fk_class_id,
        role: index % 7 === 0 ? "ClassTeacher" : "SubjectTeacher",
        created_at: now,
        updated_at: now,
      })));

      const fillers = [];
      CLASSES.forEach((cls, classIndex) => {
        const named = NAMED_STUDENTS.filter((s) => s.class === cls.key).length;
        for (let i = 1; i <= 4; i += 1) {
          const fillerParents = PARENTS.filter((person) => person.email.startsWith("family."));
          const parent = fillerParents[(classIndex + i) % fillerParents.length];
          fillers.push({
            key: `${cls.key}-${i}`,
            no: `CLS-${cls.grade.replace(/\s+/g, "").toUpperCase()}-${pad(i)}`,
            first: ["Noor", "Hamza", "Areeba", "Saad"][i - 1],
            last: parent.last,
            gender: i % 2 ? "Female" : "Male",
            class: cls.key,
            parent: parent.email,
            dob: ymd(2013 + (classIndex % 3), ((i + classIndex) % 12) + 1, 10 + i),
            admitted: SESSION.start,
          });
        }
        if (!named && fillers.length) {
          /* class still has the four fillers */
        }
      });
      const studentSpecs = [...NAMED_STUDENTS, ...fillers.filter((row) => !NAMED_STUDENTS.some((named) => named.no === row.no))];

      const parentUsers = await insert("users", PARENTS.map((p) => withSchool({
        first_name: p.first, last_name: p.last, email: p.email, phone: p.phone, password, gender: p.gender, role: "parent", status: "active",
      })));
      const parents = await insert("parents", parentUsers.map((u, i) => withSchool({
        fk_user_id: u.id,
        father_name: PARENTS[i].gender === "Male" ? `${PARENTS[i].first} ${PARENTS[i].last}` : null,
        mother_name: PARENTS[i].gender === "Female" ? `${PARENTS[i].first} ${PARENTS[i].last}` : null,
        primary_contact_number: PARENTS[i].phone,
        occupation: "Parent",
      })));
      const parentByEmail = Object.fromEntries(PARENTS.map((p, i) => [p.email, parents[i]]));

      const studentRows = await insert("students", studentSpecs.map((s) => withSchool({
        fk_class_id: classBy[s.class].id,
        admission_no: s.no,
        first_name: s.first,
        last_name: s.last,
        gender: s.gender,
        date_of_birth: s.dob,
        admission_date: s.admitted,
        status: "Active",
        discount_percent: 0,
        emergency_contact: PARENTS.find((p) => p.email === s.parent)?.phone || null,
        address: "Lahore",
      })));
      const studentBy = Object.fromEntries(studentSpecs.map((s, i) => [s.key, { ...studentRows[i], ...s }]));

      await insert("student_parents", studentSpecs.map((s) => ({
        fk_student_id: studentBy[s.key].id,
        fk_parent_id: parentByEmail[s.parent].id,
        relationship_type: PARENTS.find((p) => p.email === s.parent)?.gender === "Male" ? "Father" : "Mother",
        is_primary: true,
        created_at: now,
        updated_at: now,
      })));

      const months = [];
      const monthsFor = (s) => {
        const start = Number(s.admitted.slice(5, 7));
        const list = [];
        for (let m = start; m <= 9; m += 1) list.push(monthKey(2026, m));
        if (s.key === "rayan") list.push("2026-10");
        return list;
      };
      for (const s of Object.values(studentBy)) {
        for (const month of monthsFor(s)) {
          const fee = classBy[s.class].fee;
          months.push(withSchool({
            fk_student_id: s.id,
            month,
            fee_type: "Tuition",
            base_amount: fee,
            discount_amount: 0,
            net_amount: fee,
            paid_amount: 0,
            status: "Unpaid",
            due_date: `${month}-10`,
          }));
        }
      }
      const monthRows = await insert("student_fee_months", months);
      const ledger = new Map(monthRows.map((m) => [`${m.fk_student_id}:${m.month}`, { ...m, paid: 0 }]));

      const pay = (from, to, fee, recorder = accountant) =>
        Array.from({ length: to - from + 1 }, (_, i) => [ymd(2026, from + i, 5), fee, recorder]);
      const plan = {
        rayan: [...pay(4, 8, 8500), ["2026-10-08", 17000, accountant]],
        hira: [...pay(4, 8, 8500), ["2026-10-08", 8500, accountant]],
        daniyal: [...pay(4, 7, 8500), ["2026-08-06", 5000, accountant]],
        maham: pay(4, 9, 9000),
        usman: pay(4, 8, 9000),
        zara: pay(4, 8, 8000),
        ali: [...pay(4, 8, 8000), ["2026-10-08", 8000, admin]],
        ayaan: pay(1, 6, 8500),
      };

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
            const balance = Number(entry.net_amount) - entry.paid;
            if (remaining <= 0 || balance <= 0) continue;
            const take = Math.min(balance, remaining);
            entry.paid += take;
            remaining -= take;
            lines.push({ entry, take });
          }
          const receipt = `RCPT-${date.replace(/-/g, "")}-${pad(receiptSeq)}`;
          const [payment] = await insert("fee_payments", [withSchool({
            fk_student_id: s.id,
            receipt_no: receipt,
            amount_paid: amount,
            unallocated_amount: remaining,
            payment_method: "Cash",
            payment_date: date,
            idempotency_key: `seed-${s.id}-${date}-${receiptSeq}`,
            fk_recorded_by_user_id: recorder.id,
            notes: "Counter collection",
          })]);
          for (const line of lines) {
            allocations.push({
              fk_payment_id: payment.id,
              fk_fee_month_id: line.entry.id,
              allocated_amount: line.take,
              created_at: now,
              updated_at: now,
            });
          }
        }
      }
      await insert("fee_allocations", allocations);
      for (const entry of ledger.values()) {
        if (!entry.paid) continue;
        const due = Number(entry.net_amount);
        const status = entry.paid < due ? "Partial" : "Paid";
        await qi.bulkUpdate(
          "student_fee_months",
          { paid_amount: entry.paid, status, updated_at: now },
          { id: entry.id },
          { transaction },
        );
      }

      const hassan = teacherByCode["T-101"];
      const thursdaySlots = slotRows
        .filter((slot) => slot.fk_teacher_id === hassan.id && slot.day_of_week === "Thursday")
        .sort((a, b) => a.period_index - b.period_index);
      const coverSlot = thursdaySlots[1] || thursdaySlots[0];
      const [absence] = await insert("teacher_absences", [withSchool({
        fk_teacher_id: hassan.id,
        date: "2026-10-08",
        reason: "Medical appointment",
        status: "Approved",
        fk_approved_by_user_id: ops.id,
      })]);
      const coverTeacher = teachers.find((t) => t.id !== hassan.id && !thursdaySlots.some((slot) => slot.period_index === coverSlot.period_index && slot.fk_teacher_id === t.id));
      if (coverSlot && coverTeacher) {
        await insert("substitute_assignments", [withSchool({
          fk_absence_id: absence.id,
          fk_timetable_slot_id: coverSlot.id,
          fk_substitute_teacher_id: coverTeacher.id,
          date: "2026-10-08",
          period_index: coverSlot.period_index,
          status: "Assigned",
        })]);
      }

      const chapters = await insert("planned_chapters", [
        ["g7b", "MTH", 1, "Integers"],
        ["g7b", "MTH", 2, "Fractions and Decimals"],
        ["g7b", "MTH", 3, "Algebraic Expressions"],
        ["g7b", "ENG", 1, "Reading Comprehension"],
        ["g7b", "ENG", 2, "Tenses in Context"],
        ["g7b", "SCI", 1, "Cell Structure"],
        ["g6r", "MTH", 1, "Knowing Our Numbers"],
      ].map(([classKey, code, no, title]) => withSchool({
        fk_session_id: session.id,
        fk_class_id: classBy[classKey].id,
        fk_subject_id: subjectBy[code].id,
        chapter_no: no,
        title,
        planned_start_date: "2026-09-01",
        planned_end_date: "2026-09-30",
        status: no === 3 ? "InProgress" : "Planned",
      })));
      const chapter = (classKey, code, no) => chapters.find((row) => row.fk_class_id === classBy[classKey].id && row.fk_subject_id === subjectBy[code].id && row.chapter_no === no);

      await insert("daily_lessons", [
        { classKey: "g7b", code: "MTH", no: 3, date: "2026-10-06", topic: "Adding algebraic expressions", homework: "Exercise 3.1, questions 1–6" },
        { classKey: "g7b", code: "ENG", no: 2, date: "2026-10-06", topic: "Past continuous in a story", homework: "Write ten sentences" },
        { classKey: "g7b", code: "SCI", no: 1, date: "2026-10-07", topic: "Parts of a plant cell", homework: "Label the diagram" },
      ].map((row) => withSchool({
        fk_class_id: classBy[row.classKey].id,
        fk_subject_id: subjectBy[row.code].id,
        fk_teacher_id: teacherByCode[TEACHERS.find((t) => t.subject === row.code).code].id,
        fk_chapter_id: chapter(row.classKey, row.code, row.no).id,
        date: row.date,
        topic: row.topic,
        homework: row.homework,
        notes: "Recorded in class",
      })));

      const [mathSchedule] = await insert("daily_test_schedules", [withSchool({
        fk_class_id: classBy.g7b.id,
        day_of_week: "Thursday",
        fk_subject_id: subjectBy.MTH.id,
      })]);
      const testDates = ["2026-09-03", "2026-09-10", "2026-09-17", "2026-09-24", "2026-10-01", "2026-10-08"];
      const tests = await insert("daily_tests", testDates.map((date, index) => withSchool({
        fk_class_id: classBy.g7b.id,
        fk_subject_id: subjectBy.MTH.id,
        fk_teacher_id: hassan.id,
        date,
        total_marks: 20,
        title: `Mathematics weekly test ${index + 1}`,
      })));
      const scores = { rayan: [16, 18, 15, 17, 18, 16], ayaan: [6, 12, 7, 11, 8, 9], hira: [9, 10, 10, 10, 12, 11], daniyal: [14, 8, 13, 15, 14, 16] };
      const results = [];
      for (const [key, marks] of Object.entries(scores)) {
        marks.forEach((mark, index) => {
          results.push({
            fk_daily_test_id: tests[index].id,
            fk_student_id: studentBy[key].id,
            obtained_marks: mark,
            is_absent: false,
            created_at: now,
            updated_at: now,
          });
        });
      }
      await insert("daily_test_results", results);
      await insert("monthly_student_summaries", [
        { key: "ayaan", percent: 45, fee: "Unpaid", remarks: "Failed two mathematics weekly tests in September." },
        { key: "rayan", percent: 82, fee: "Paid", remarks: "Consistent weekly scores." },
        { key: "daniyal", percent: 62, fee: "Partial", remarks: "August fee is only partly paid." },
      ].map((row) => withSchool({
        fk_student_id: studentBy[row.key].id,
        month: "2026-09",
        attendance_percentage: 92,
        daily_test_percentage: row.percent,
        fee_status: row.fee,
        teacher_remarks: row.remarks,
      })));

      const [exam] = await insert("exams", [withSchool({
        fk_session_id: session.id,
        name: "September Monthly Assessment",
        start_date: "2026-09-21",
        end_date: "2026-09-25",
        status: "Published",
        required_fee_month: "2026-09",
      })]);
      await insert("exam_classes", [{ fk_exam_id: exam.id, fk_class_id: classBy.g7b.id, created_at: now, updated_at: now }]);
      const sheetPlan = [
        { code: "MTH", status: "Published", scores: { rayan: 86, ayaan: 58, hira: 64, daniyal: 71 } },
        { code: "ENG", status: "Published", scores: { rayan: 79, ayaan: 62, hira: 75, daniyal: 68 } },
        { code: "SCI", status: "Approved", scores: { rayan: 88, ayaan: 55, hira: 70, daniyal: 74 } },
      ];
      for (const spec of sheetPlan) {
        const [sheet] = await insert("mark_sheets", [{
          fk_exam_id: exam.id,
          fk_class_id: classBy.g7b.id,
          fk_subject_id: subjectBy[spec.code].id,
          total_marks: 100,
          passing_marks: 40,
          status: spec.status,
          fk_submitted_by_user_id: userBy[TEACHERS.find((t) => t.subject === spec.code).email].id,
          fk_approved_by_user_id: spec.status === "Draft" ? null : ops.id,
          created_at: now,
          updated_at: now,
        }]);
        await insert("mark_sheet_rows", Object.entries(spec.scores).map(([key, score]) => ({
          fk_mark_sheet_id: sheet.id,
          fk_student_id: studentBy[key].id,
          obtained_marks: score,
          is_absent: false,
          created_at: now,
          updated_at: now,
        })));
      }
      await insert("result_visibility_overrides", [withSchool({
        fk_exam_id: exam.id,
        fk_student_id: studentBy.daniyal.id,
        fk_granted_by_user_id: ops.id,
        reason: "Principal approved release while the August balance is under scholarship review.",
        granted_at: new Date("2026-09-28T09:30:00+05:00"),
      })]);

      const attendance = [];
      for (const date of ["2026-10-07", "2026-10-08"]) {
        Object.values(studentBy).forEach((s, index) => {
          let status = "Present";
          if (s.key === "ayaan" && date === "2026-10-07") status = "Absent";
          else if (index % 17 === 0) status = "Excused";
          attendance.push(withSchool({
            fk_student_id: s.id,
            fk_class_id: classBy[s.class].id,
            date,
            status,
            fk_marked_by_user_id: userBy["hassan@cls.edu.pk"].id,
          }));
        });
      }
      await insert("attendances", attendance);

      const applications = await insert("applications", [
        { first: "Mustafa", last: "Iqbal", gender: "Male", dob: "2015-04-02", grade: "Grade 6", parent: "Asif Iqbal", phone: "0300-4441122", status: "UnderReview" },
        { first: "Anaya", last: "Qureshi", gender: "Female", dob: "2014-08-16", grade: "Grade 7", parent: "Sana Qureshi", phone: "0321-7778899", status: "Inquiry" },
        { first: "Zohaib", last: "Hassan", gender: "Male", dob: "2020-01-11", grade: "KG", parent: "Hassan Raza", phone: "0333-5556677", status: "Enrolled" },
        { first: "Hamna", last: "Tariq", gender: "Female", dob: "2019-06-20", grade: "Grade 1", parent: "Tariq Mehmood", phone: "0345-8889900", status: "InterviewScheduled" },
        { first: "Rehan", last: "Shah", gender: "Male", dob: "2011-09-09", grade: "Grade 9", parent: "Shahid Shah", phone: "0312-3334455", status: "Rejected" },
      ].map((row) => withSchool({
        fk_session_id: session.id,
        applicant_first_name: row.first,
        applicant_last_name: row.last,
        gender: row.gender,
        date_of_birth: row.dob,
        grade_applying_for: row.grade,
        parent_name: row.parent,
        parent_phone: row.phone,
        status: row.status,
        notes: "Seeded admission file",
      })));
      await insert("application_documents", [
        { fk_application_id: applications[0].id, title: "Guardian CNIC", file_url: "seed://cnic", document_type: "cnic" },
        { fk_application_id: applications[0].id, title: "Birth certificate", file_url: "seed://birth", document_type: "birth" },
        { fk_application_id: applications[1].id, title: "Birth certificate", file_url: "seed://birth", document_type: "birth" },
        { fk_application_id: applications[2].id, title: "Photograph", file_url: "seed://photo", document_type: "photo" },
      ].map((row) => ({ ...row, created_at: now, updated_at: now })));

      await insert("expenses", [
        ["September staff payroll", "Payroll", 640000, "2026-09-25"],
        ["Science lab consumables", "Academic supplies", 38500, "2026-09-12"],
        ["Campus utilities", "Utilities", 85000, "2026-09-18"],
        ["Facilities maintenance", "Maintenance", 42000, "2026-09-15"],
      ].map(([title, category, amount, date]) => withSchool({
        title, category, amount, expense_date: date, fk_recorded_by_user_id: admin.id,
      })));

      await qi.bulkInsert("audit_logs", [
        withSchool({
          fk_user_id: ops.id,
          action: "Released September result for Daniyal Khan despite the August balance",
          entity_type: "result_visibility_override",
          entity_id: studentBy.daniyal.id,
          new_values: JSON.stringify({ student: "Daniyal Khan", exam: "September Monthly Assessment" }),
          created_at: now,
        }),
        withSchool({
          fk_user_id: accountant.id,
          action: "Recorded counter receipts on 8 Oct 2026",
          entity_type: "fee_payment",
          new_values: JSON.stringify({ date: "2026-10-08" }),
          created_at: now,
        }),
      ], { transaction });

      void mathSchedule;
    });
  },

  async down(queryInterface) {
    const qi = queryInterface;
    const [[school]] = await qi.sequelize.query(`SELECT id FROM schools WHERE email = :email LIMIT 1`, {
      replacements: { email: SCHOOL_EMAIL },
    });
    if (!school) return;
    const id = school.id;
    await qi.sequelize.transaction(async (transaction) => {
      const q = (sql) => qi.sequelize.query(sql, { replacements: { id }, transaction });
      await q(`DELETE FROM fee_allocations WHERE fk_payment_id IN (SELECT id FROM fee_payments WHERE fk_school_id = :id)`);
      await q(`DELETE FROM mark_sheet_rows WHERE fk_mark_sheet_id IN (SELECT id FROM mark_sheets WHERE fk_exam_id IN (SELECT id FROM exams WHERE fk_school_id = :id))`);
      await q(`DELETE FROM mark_sheets WHERE fk_exam_id IN (SELECT id FROM exams WHERE fk_school_id = :id)`);
      await q(`DELETE FROM daily_test_results WHERE fk_daily_test_id IN (SELECT id FROM daily_tests WHERE fk_school_id = :id)`);
      await q(`DELETE FROM exam_classes WHERE fk_exam_id IN (SELECT id FROM exams WHERE fk_school_id = :id)`);
      await q(`DELETE FROM application_documents WHERE fk_application_id IN (SELECT id FROM applications WHERE fk_school_id = :id)`);
      await q(`DELETE FROM student_parents WHERE fk_student_id IN (SELECT id FROM students WHERE fk_school_id = :id)`);
      await q(`DELETE FROM class_subjects WHERE fk_class_id IN (SELECT id FROM classes WHERE fk_school_id = :id)`);
      await q(`DELETE FROM teacher_classes WHERE fk_teacher_id IN (SELECT id FROM teachers WHERE fk_school_id = :id)`);
      for (const table of [
        "audit_logs", "expenses", "attendances", "result_visibility_overrides", "exams",
        "monthly_student_summaries", "daily_tests", "daily_test_schedules", "daily_lessons", "planned_chapters",
        "substitute_assignments", "teacher_absences", "timetable_slots", "student_fee_months", "fee_payments",
        "applications", "parents", "teacher_subject_assignments", "teachers", "students", "classes", "subjects",
        "school_settings", "academic_sessions", "users",
      ]) {
        await q(`DELETE FROM ${table} WHERE fk_school_id = :id`);
      }
      await q(`DELETE FROM schools WHERE id = :id`);
    });
  },
};
