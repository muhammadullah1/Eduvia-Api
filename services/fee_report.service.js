"use strict";

/**
 * Fee reports (SRS 4.5 "collection reports"): daily and monthly collections,
 * class-wise and student-wise positions, outstanding fees and advance payments.
 *
 * Access (client addendum, fee rules):
 * - Super Admin: every report, with totals.
 * - Accountant: only the daily collections report, limited to receipts they
 *   recorded themselves, and never any total, count or summary.
 * - Everyone else is refused by the route (`fees.reports`).
 *
 * All figures come from the ledger (`student_fee_months`) and confirmed
 * (`Paid`) receipts, plus the student credit ledger for advance money. Students
 * are grouped by their current class; defaulters have overdue unpaid months.
 */
const { QueryTypes } = require("sequelize");
const { sequelize, Classes } = require("../models");
const { USER_ROLES } = require("../constants");
const ApiError = require("../utils/ApiError");
const { today, addMonths, firstOfMonth } = require("../utils/dates");
const { money } = require("../utils/report_export");

const REPORT_KINDS = ["daily", "monthly", "class-wise", "student-wise", "outstanding", "advance", "defaulters"];
const ACCOUNTANT_KINDS = new Set(["daily"]);
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthLabel = (m) => `${MONTH_NAMES[Number(String(m).slice(5, 7)) - 1]} ${String(m).slice(0, 4)}`;
const METHODS = [
  ["Cash", "cash"],
  ["BankTransfer", "bankTransfer"],
  ["Cheque", "cheque"],
  ["Online", "online"],
];
const METHOD_LABEL = { Cash: "Cash", BankTransfer: "Bank transfer", Cheque: "Cheque", Online: "Online" };

const n = (value) => Math.round(Number(value || 0) * 100) / 100;
const sum = (rows, key) => n(rows.reduce((s, r) => s + Math.round(Number(r[key] || 0) * 100), 0) / 100);
const fullName = (first, last) => [first, last].filter(Boolean).join(" ").trim();
const day = (value) => (value instanceof Date ? value.toISOString().slice(0, 10) : String(value || "").slice(0, 10));

/** Allowed kinds for a role. */
function kindsFor(role) {
  if (role === USER_ROLES.SUPER_ADMIN) return REPORT_KINDS;
  if (role === USER_ROLES.ACCOUNTANT) return REPORT_KINDS.filter((k) => ACCOUNTANT_KINDS.has(k));
  return [];
}

function assertKind(actor, kind) {
  if (!REPORT_KINDS.includes(kind)) throw new ApiError(404, "Unknown report.");
  if (!kindsFor(actor.role).includes(kind)) throw new ApiError(403, "You can't open this report.");
}

const query = (sql, replacements) => sequelize.query(sql, { replacements, type: QueryTypes.SELECT });

async function classLabel(actor, classId) {
  if (!classId) return "All classes";
  const klass = await Classes.findOne({ where: { id: classId, fkSchoolId: actor.schoolId }, attributes: ["id", "label"] });
  if (!klass) throw new ApiError(404, "Class not found");
  return klass.label;
}

// ---- collections ---------------------------------------------------------

async function paymentRows(actor, { from, to, classId }) {
  const own = actor.role === USER_ROLES.ACCOUNTANT;
  return query(
    `SELECT p.id, p.payment_date, p.receipt_no, p.reference_no, p.payment_method, p.amount_paid, p.period,
            s.admission_no, s.first_name, s.last_name, c.label AS class_label,
            u.first_name AS by_first, u.last_name AS by_last
       FROM fee_payments p
       JOIN students s ON s.id = p.fk_student_id
       LEFT JOIN classes c ON c.id = s.fk_class_id
       LEFT JOIN users u ON u.id = p.fk_recorded_by_user_id
      WHERE p.fk_school_id = :schoolId AND p.archived_at IS NULL AND p.status = 'Paid'
        AND p.payment_date BETWEEN :from AND :to
        ${classId ? "AND s.fk_class_id = :classId" : ""}
        ${own ? "AND p.fk_recorded_by_user_id = :userId" : ""}
      ORDER BY p.payment_date, p.id`,
    { schoolId: actor.schoolId, from, to, classId: classId || null, userId: actor.id },
  );
}

async function daily(actor, { from, to, classId }) {
  const start = from || to || today();
  const end = to || start;
  if (end < start) throw new ApiError(400, "The end date must be on or after the start date.");
  const rows = (await paymentRows(actor, { from: start, to: end, classId })).map((r) => ({
    date: day(r.payment_date),
    receiptNo: r.receipt_no,
    reference: r.reference_no || "",
    admissionNo: r.admission_no,
    student: fullName(r.first_name, r.last_name),
    className: r.class_label || "",
    months: r.period || "",
    method: METHOD_LABEL[r.payment_method] || r.payment_method,
    amount: n(r.amount_paid),
    recordedBy: fullName(r.by_first, r.by_last),
  }));
  const own = actor.role === USER_ROLES.ACCOUNTANT;
  const columns = [
    { key: "date", label: "Date", width: 0.09 },
    { key: "receiptNo", label: "Receipt no", width: 0.15 },
    { key: "admissionNo", label: "Admission no", width: 0.1 },
    { key: "student", label: "Student", width: 0.16 },
    { key: "className", label: "Class", width: 0.1 },
    { key: "months", label: "Months covered", width: 0.15 },
    { key: "method", label: "Method", width: 0.09 },
    { key: "amount", label: "Amount (PKR)", type: "money", width: 0.1 },
    ...(own ? [] : [{ key: "recordedBy", label: "Recorded by", width: 0.11 }]),
  ];
  let summary = null;
  if (!own) {
    summary = [
      ["Receipts", rows.length],
      ["Total collected (PKR)", money(sum(rows, "amount"))],
      ...METHODS.map(([method]) => [`${METHOD_LABEL[method]} (PKR)`, money(sum(rows.filter((r) => r.method === METHOD_LABEL[method]), "amount"))]),
    ];
  }
  const range = start === end ? start : `${start} to ${end}`;
  return {
    kind: "daily",
    title: own ? "My daily collections" : "Daily fee collections",
    filename: `daily-collections-${start}${start === end ? "" : `-to-${end}`}`,
    filters: { from: start, to: end, classId: classId || null },
    meta: [
      ["Date", range],
      ["Class", await classLabel(actor, classId)],
      ...(own ? [["Scope", "Receipts you recorded"]] : []),
    ],
    columns,
    rows,
    summary,
  };
}

async function monthly(actor, { month, classId }) {
  const target = month || today().slice(0, 7);
  const from = firstOfMonth(target);
  const to = addMonths(from, 1);
  const raw = await query(
    `SELECT p.payment_date, COUNT(*)::int AS receipts,
            ${METHODS.map(([m, key]) => `COALESCE(SUM(p.amount_paid) FILTER (WHERE p.payment_method = '${m}'), 0) AS "${key}"`).join(", ")},
            COALESCE(SUM(p.amount_paid), 0) AS total
       FROM fee_payments p
       JOIN students s ON s.id = p.fk_student_id
      WHERE p.fk_school_id = :schoolId AND p.archived_at IS NULL AND p.status = 'Paid'
        AND p.payment_date >= :from AND p.payment_date < :to
        ${classId ? "AND s.fk_class_id = :classId" : ""}
      GROUP BY p.payment_date
      ORDER BY p.payment_date`,
    { schoolId: actor.schoolId, from, to, classId: classId || null },
  );
  const rows = raw.map((r) => ({
    date: day(r.payment_date),
    receipts: r.receipts,
    cash: n(r.cash),
    bankTransfer: n(r.bankTransfer),
    cheque: n(r.cheque),
    online: n(r.online),
    total: n(r.total),
  }));
  return {
    kind: "monthly",
    title: "Monthly fee collections",
    filename: `monthly-collections-${target}`,
    filters: { month: target, classId: classId || null },
    meta: [["Month", monthLabel(target)], ["Class", await classLabel(actor, classId)]],
    columns: [
      { key: "date", label: "Date", width: 0.16 },
      { key: "receipts", label: "Receipts", type: "number", width: 0.1 },
      { key: "cash", label: "Cash", type: "money", width: 0.14 },
      { key: "bankTransfer", label: "Bank transfer", type: "money", width: 0.15 },
      { key: "cheque", label: "Cheque", type: "money", width: 0.14 },
      { key: "online", label: "Online", type: "money", width: 0.14 },
      { key: "total", label: "Total (PKR)", type: "money", width: 0.17 },
    ],
    rows,
    summary: [
      ["Days with collections", rows.length],
      ["Receipts", rows.reduce((s, r) => s + r.receipts, 0)],
      ["Total collected (PKR)", money(sum(rows, "total"))],
    ],
  };
}

// ---- ledger positions ------------------------------------------------------
//
// Counting rules (Step 6):
// - A student has one bill row per fee type per month (Tuition, Annual, Admission, ...).
//   Every "student" or "month" count below is taken over bills first grouped per
//   (student, month), so extra fee types never inflate a count.
// - Advance money is the live credit-ledger balance (`student_credit_ledger`), not
//   `fee_payments.unallocated_amount` (history only).

/** One row per (student, month): bill rows of every fee type summed. */
const STUDENT_MONTHS_CTE = `student_months AS (
  SELECT m.fk_student_id AS sid, m.month,
         SUM(m.collectible_amount) AS net,
         SUM(m.paid_amount) AS paid,
         SUM(GREATEST(m.collectible_amount - m.paid_amount, 0)) AS open,
         COALESCE(MIN(m.due_date), (to_date(m.month || '-01', 'YYYY-MM-DD') + INTERVAL '1 month' - INTERVAL '1 day')::date) AS due_date
    FROM student_fee_months m
   WHERE m.fk_school_id = :schoolId AND m.archived_at IS NULL
   GROUP BY m.fk_student_id, m.month)`;

const CREDIT_BALANCE_SQL = `(SELECT COALESCE(SUM(CASE WHEN l.entry_type = 'Credit' THEN l.amount ELSE -l.amount END), 0)
     FROM student_credit_ledger l WHERE l.fk_student_id = s.id)`;

const percent = (part, whole) => (n(whole) > 0 ? Math.round((n(part) / n(whole)) * 1000) / 10 : null);

async function classWise(actor, { month, classId }) {
  const target = month || today().slice(0, 7);
  const raw = await query(
    `WITH ${STUDENT_MONTHS_CTE},
          this_month AS (SELECT sid, net, paid FROM student_months WHERE month = :month),
          up_to AS (SELECT sid, SUM(open) AS open FROM student_months WHERE month <= :month GROUP BY sid)
     SELECT c.id, c.label,
            COUNT(s.id) FILTER (WHERE s.status IN ('Active', 'Pending'))::int AS enrolled,
            COUNT(tm.sid)::int AS billed_students,
            COUNT(tm.sid) FILTER (WHERE tm.paid >= tm.net)::int AS paid_students,
            COUNT(tm.sid) FILTER (WHERE tm.paid > 0 AND tm.paid < tm.net)::int AS partial_students,
            COUNT(tm.sid) FILTER (WHERE tm.paid <= 0 AND tm.net > 0)::int AS unpaid_students,
            COALESCE(SUM(tm.net), 0) AS billed,
            COALESCE(SUM(tm.paid), 0) AS collected,
            COALESCE(SUM(td.open), 0) AS outstanding
       FROM classes c
       LEFT JOIN students s ON s.fk_class_id = c.id AND s.archived_at IS NULL
       LEFT JOIN this_month tm ON tm.sid = s.id
       LEFT JOIN up_to td ON td.sid = s.id
      WHERE c.fk_school_id = :schoolId AND c.archived_at IS NULL
        ${classId ? "AND c.id = :classId" : ""}
      GROUP BY c.id, c.label
      ORDER BY c.label, c.id`,
    { schoolId: actor.schoolId, month: target, classId: classId || null },
  );
  const rows = raw.map((r) => ({
    className: r.label,
    enrolled: r.enrolled,
    billedStudents: r.billed_students,
    paidStudents: r.paid_students,
    partialStudents: r.partial_students,
    unpaidStudents: r.unpaid_students,
    billed: n(r.billed),
    collected: n(r.collected),
    outstanding: n(r.outstanding),
    collectionRate: percent(r.collected, r.billed),
  }));
  const billed = sum(rows, "billed");
  const collected = sum(rows, "collected");
  const rate = percent(collected, billed);
  return {
    kind: "class-wise",
    title: "Class-wise fee report",
    filename: `class-wise-fees-${target}`,
    filters: { month: target, classId: classId || null },
    meta: [
      ["Month", monthLabel(target)],
      ["Class", await classLabel(actor, classId)],
      ["Note", "Counts are students, not bills. Paid students = every fee for the month fully paid. Billed, collected and collection % are for the month; outstanding includes every month up to it."],
    ],
    columns: [
      { key: "className", label: "Class", width: 0.14 },
      { key: "enrolled", label: "Enrolled", type: "number", width: 0.08 },
      { key: "billedStudents", label: "Billed students", type: "number", width: 0.09 },
      { key: "paidStudents", label: "Paid students", type: "number", width: 0.08 },
      { key: "partialStudents", label: "Partial", type: "number", width: 0.07 },
      { key: "unpaidStudents", label: "Unpaid", type: "number", width: 0.07 },
      { key: "billed", label: "Billed (PKR)", type: "money", width: 0.12 },
      { key: "collected", label: "Collected (PKR)", type: "money", width: 0.12 },
      { key: "outstanding", label: "Outstanding (PKR)", type: "money", width: 0.13 },
      { key: "collectionRate", label: "Collection %", type: "percent", width: 0.1 },
    ],
    rows,
    summary: [
      ["Enrolled students", rows.reduce((s, r) => s + r.enrolled, 0)],
      ["Paid students", rows.reduce((s, r) => s + r.paidStudents, 0)],
      ["Billed for the month (PKR)", money(billed)],
      ["Collected against the month (PKR)", money(collected)],
      ["Outstanding to date (PKR)", money(sum(rows, "outstanding"))],
      ["Collection %", rate == null ? "—" : `${rate}%`],
    ],
  };
}

async function studentLedger(actor, { month, classId }) {
  const target = month || today().slice(0, 7);
  return query(
    `WITH ${STUDENT_MONTHS_CTE}
     SELECT s.id, s.admission_no, s.first_name, s.last_name, s.status, c.label AS class_label,
            COUNT(b.month) FILTER (WHERE b.month <= :month)::int AS months_billed,
            COALESCE(SUM(b.net) FILTER (WHERE b.month <= :month), 0) AS due,
            COALESCE(SUM(b.paid) FILTER (WHERE b.month <= :month), 0) AS paid,
            COALESCE(SUM(b.open) FILTER (WHERE b.month <= :month), 0) AS outstanding,
            STRING_AGG(b.month, ',' ORDER BY b.month) FILTER (WHERE b.month <= :month AND b.open > 0) AS open_months,
            STRING_AGG(b.month, ',' ORDER BY b.month) FILTER (WHERE b.month <= :month AND b.open > 0 AND b.due_date < :today) AS overdue_months,
            COALESCE(SUM(b.open) FILTER (WHERE b.month <= :month AND b.open > 0 AND b.due_date < :today), 0) AS overdue,
            MAX(b.month) FILTER (WHERE b.month <= :month AND b.open = 0 AND b.paid > 0) AS last_paid_month,
            COALESCE(SUM(b.paid) FILTER (WHERE b.month > :month AND b.paid > 0), 0) AS paid_ahead,
            STRING_AGG(b.month, ',' ORDER BY b.month) FILTER (WHERE b.month > :month AND b.paid > 0) AS paid_ahead_months,
            ${CREDIT_BALANCE_SQL} AS credit,
            (SELECT MAX(p.payment_date) FROM fee_payments p
              WHERE p.fk_student_id = s.id AND p.archived_at IS NULL AND p.status = 'Paid') AS last_payment
       FROM students s
       LEFT JOIN classes c ON c.id = s.fk_class_id
       LEFT JOIN student_months b ON b.sid = s.id
      WHERE s.fk_school_id = :schoolId AND s.archived_at IS NULL
        ${classId ? "AND s.fk_class_id = :classId" : ""}
      GROUP BY s.id, c.label
      ORDER BY c.label NULLS LAST, s.first_name, s.last_name, s.id`,
    { schoolId: actor.schoolId, month: target, classId: classId || null, today: today() },
  );
}

const months = (csv) => (csv ? csv.split(",").map(monthLabel).join(", ") : "");
const countOf = (csv) => (csv ? csv.split(",").length : 0);

async function studentWise(actor, { month, classId }) {
  const target = month || today().slice(0, 7);
  const raw = await studentLedger(actor, { month: target, classId });
  const rows = raw
    .filter((r) => r.months_billed > 0 || ["Active", "Pending"].includes(r.status) || n(r.credit) > 0)
    .map((r) => ({
      admissionNo: r.admission_no,
      student: fullName(r.first_name, r.last_name),
      className: r.class_label || "",
      status: r.status,
      monthsBilled: r.months_billed,
      monthsOpen: countOf(r.open_months),
      due: n(r.due),
      paid: n(r.paid),
      outstanding: n(r.outstanding),
      credit: n(r.credit),
      lastPayment: r.last_payment ? day(r.last_payment) : "",
    }));
  return {
    kind: "student-wise",
    title: "Student-wise fee report",
    filename: `student-wise-fees-${target}`,
    filters: { month: target, classId: classId || null },
    meta: [
      ["Up to month", monthLabel(target)],
      ["Class", await classLabel(actor, classId)],
      ["Note", "Months count calendar months (all fee types of a month count once). Credit = live credit-ledger balance."],
    ],
    columns: [
      { key: "admissionNo", label: "Admission no", width: 0.1 },
      { key: "student", label: "Student", width: 0.16 },
      { key: "className", label: "Class", width: 0.09 },
      { key: "status", label: "Status", width: 0.07 },
      { key: "monthsBilled", label: "Months billed", type: "number", width: 0.07 },
      { key: "monthsOpen", label: "Months open", type: "number", width: 0.07 },
      { key: "due", label: "Due (PKR)", type: "money", width: 0.1 },
      { key: "paid", label: "Paid (PKR)", type: "money", width: 0.1 },
      { key: "outstanding", label: "Outstanding (PKR)", type: "money", width: 0.1 },
      { key: "credit", label: "Credit (PKR)", type: "money", width: 0.07 },
      { key: "lastPayment", label: "Last payment", width: 0.07 },
    ],
    rows,
    summary: [
      ["Students", rows.length],
      ["Due to date (PKR)", money(sum(rows, "due"))],
      ["Paid to date (PKR)", money(sum(rows, "paid"))],
      ["Outstanding (PKR)", money(sum(rows, "outstanding"))],
      ["Credit balance (PKR)", money(sum(rows, "credit"))],
    ],
  };
}

async function outstandingReport(actor, { month, classId }) {
  const target = month || today().slice(0, 7);
  const raw = await studentLedger(actor, { month: target, classId });
  const rows = raw
    .filter((r) => n(r.outstanding) > 0)
    .map((r) => {
      const open = r.open_months ? r.open_months.split(",") : [];
      return {
        admissionNo: r.admission_no,
        student: fullName(r.first_name, r.last_name),
        className: r.class_label || "",
        status: r.status,
        openMonths: open.length,
        months: months(r.open_months),
        oldest: open.length ? monthLabel(open[0]) : "",
        outstanding: n(r.outstanding),
        credit: n(r.credit),
      };
    })
    .sort((a, b) => b.outstanding - a.outstanding || a.student.localeCompare(b.student));
  return {
    kind: "outstanding",
    title: "Outstanding fees",
    filename: `outstanding-fees-${target}`,
    filters: { month: target, classId: classId || null },
    meta: [
      ["Up to month", monthLabel(target)],
      ["Class", await classLabel(actor, classId)],
      ["Note", "Open months count calendar months, not bills."],
    ],
    columns: [
      { key: "admissionNo", label: "Admission no", width: 0.11 },
      { key: "student", label: "Student", width: 0.17 },
      { key: "className", label: "Class", width: 0.1 },
      { key: "status", label: "Status", width: 0.08 },
      { key: "openMonths", label: "Open months", type: "number", width: 0.08 },
      { key: "months", label: "Unpaid months", width: 0.2 },
      { key: "oldest", label: "Oldest", width: 0.08 },
      { key: "outstanding", label: "Outstanding (PKR)", type: "money", width: 0.11 },
      { key: "credit", label: "Credit (PKR)", type: "money", width: 0.07 },
    ],
    rows,
    summary: [
      ["Students with dues", rows.length],
      ["Open student-months", rows.reduce((s, r) => s + r.openMonths, 0)],
      ["Total outstanding (PKR)", money(sum(rows, "outstanding"))],
    ],
  };
}

async function advanceReport(actor, { month, classId }) {
  const target = month || today().slice(0, 7);
  const raw = await studentLedger(actor, { month: target, classId });
  const rows = raw
    .filter((r) => n(r.paid_ahead) > 0 || n(r.credit) > 0)
    .map((r) => ({
      admissionNo: r.admission_no,
      student: fullName(r.first_name, r.last_name),
      className: r.class_label || "",
      credit: n(r.credit),
      months: months(r.paid_ahead_months),
      paidAhead: n(r.paid_ahead),
    }))
    .sort((a, b) => b.credit - a.credit || a.student.localeCompare(b.student));
  return {
    kind: "advance",
    title: "Advance & credit balances",
    filename: `advance-credit-${target}`,
    filters: { month: target, classId: classId || null },
    meta: [
      ["After month", monthLabel(target)],
      ["Class", await classLabel(actor, classId)],
      ["Note", "Credit = live balance of the student credit ledger (auto-applied to the next bills). Paid ahead = money already allocated to months after the selected month."],
    ],
    columns: [
      { key: "admissionNo", label: "Admission no", width: 0.13 },
      { key: "student", label: "Student", width: 0.22 },
      { key: "className", label: "Class", width: 0.13 },
      { key: "credit", label: "Credit balance (PKR)", type: "money", width: 0.15 },
      { key: "months", label: "Months paid ahead", width: 0.22 },
      { key: "paidAhead", label: "Paid ahead (PKR)", type: "money", width: 0.15 },
    ],
    rows,
    summary: [
      ["Students with credit or advance", rows.length],
      ["Credit balance (PKR)", money(sum(rows, "credit"))],
      ["Paid ahead for later months (PKR)", money(sum(rows, "paidAhead"))],
    ],
  };
}

async function defaulters(actor, { month, classId }) {
  const target = month || today().slice(0, 7);
  const raw = await studentLedger(actor, { month: target, classId });
  const rows = raw
    .filter((r) => n(r.overdue) > 0)
    .map((r) => ({
      admissionNo: r.admission_no,
      student: fullName(r.first_name, r.last_name),
      className: r.class_label || "",
      status: r.status,
      lastPaid: r.last_paid_month ? monthLabel(r.last_paid_month) : "Never",
      lastPayment: r.last_payment ? day(r.last_payment) : "",
      monthsUnpaid: countOf(r.overdue_months),
      months: months(r.overdue_months),
      outstanding: n(r.overdue),
    }))
    .sort((a, b) => b.monthsUnpaid - a.monthsUnpaid || b.outstanding - a.outstanding || a.student.localeCompare(b.student));
  return {
    kind: "defaulters",
    title: "Defaulters list",
    filename: `defaulters-${target}`,
    filters: { month: target, classId: classId || null },
    meta: [
      ["Up to month", monthLabel(target)],
      ["Class", await classLabel(actor, classId)],
      ["Overdue as of", today()],
      ["Note", "A defaulter has at least one month past its due date that is not fully paid. Last paid = latest fully paid month."],
    ],
    columns: [
      { key: "admissionNo", label: "Admission no", width: 0.1 },
      { key: "student", label: "Student", width: 0.16 },
      { key: "className", label: "Class", width: 0.1 },
      { key: "status", label: "Status", width: 0.07 },
      { key: "lastPaid", label: "Last paid", width: 0.09 },
      { key: "lastPayment", label: "Last payment", width: 0.09 },
      { key: "monthsUnpaid", label: "Months unpaid", type: "number", width: 0.08 },
      { key: "months", label: "Overdue months", width: 0.19 },
      { key: "outstanding", label: "Outstanding (PKR)", type: "money", width: 0.12 },
    ],
    rows,
    summary: [
      ["Defaulters", rows.length],
      ["Overdue student-months", rows.reduce((s, r) => s + r.monthsUnpaid, 0)],
      ["Overdue amount (PKR)", money(sum(rows, "outstanding"))],
    ],
  };
}

const BUILDERS = {
  daily,
  monthly,
  "class-wise": classWise,
  "student-wise": studentWise,
  outstanding: outstandingReport,
  advance: advanceReport,
  defaulters,
};

async function build(actor, kind, filters = {}) {
  assertKind(actor, kind);
  return BUILDERS[kind](actor, filters);
}

module.exports = { REPORT_KINDS, kindsFor, build };
