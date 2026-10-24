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
 * (`Paid`) receipts. Students are grouped by their current class.
 */
const { QueryTypes } = require("sequelize");
const { sequelize, Classes } = require("../models");
const { USER_ROLES } = require("../constants");
const ApiError = require("../utils/ApiError");
const { today, addMonths, firstOfMonth } = require("../utils/dates");
const { money } = require("../utils/report_export");

const REPORT_KINDS = ["daily", "monthly", "class-wise", "student-wise", "outstanding", "advance"];
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

/** Status of one ledger month as of `asOf` (YYYY-MM), mirroring utils/fee_allocation. */
const LEDGER_STATUS_SQL = (asOf) => `CASE
  WHEN m.paid_amount <= 0 THEN 'Unpaid'
  WHEN m.paid_amount < m.net_amount THEN 'Partial'
  WHEN m.month > ${asOf} THEN 'Advance'
  ELSE 'Paid' END`;

async function classWise(actor, { month, classId }) {
  const target = month || today().slice(0, 7);
  const raw = await query(
    `SELECT c.id, c.label,
            COUNT(DISTINCT s.id) FILTER (WHERE s.status IN ('Active', 'Pending'))::int AS students,
            COALESCE(SUM(m.net_amount) FILTER (WHERE m.month = :month), 0) AS billed,
            COALESCE(SUM(m.paid_amount) FILTER (WHERE m.month = :month), 0) AS collected,
            COALESCE(SUM(GREATEST(m.net_amount - m.paid_amount, 0)) FILTER (WHERE m.month <= :month), 0) AS outstanding,
            COUNT(*) FILTER (WHERE m.month = :month AND ${LEDGER_STATUS_SQL(":month")} IN ('Paid', 'Advance'))::int AS paid_count,
            COUNT(*) FILTER (WHERE m.month = :month AND ${LEDGER_STATUS_SQL(":month")} = 'Partial')::int AS partial_count,
            COUNT(*) FILTER (WHERE m.month = :month AND ${LEDGER_STATUS_SQL(":month")} = 'Unpaid')::int AS unpaid_count
       FROM classes c
       LEFT JOIN students s ON s.fk_class_id = c.id AND s.archived_at IS NULL
       LEFT JOIN student_fee_months m ON m.fk_student_id = s.id AND m.archived_at IS NULL
      WHERE c.fk_school_id = :schoolId AND c.archived_at IS NULL
        ${classId ? "AND c.id = :classId" : ""}
      GROUP BY c.id, c.label
      ORDER BY c.id`,
    { schoolId: actor.schoolId, month: target, classId: classId || null },
  );
  const rows = raw.map((r) => ({
    className: r.label,
    students: r.students,
    billed: n(r.billed),
    collected: n(r.collected),
    balance: n(n(r.billed) - n(r.collected)),
    paid: r.paid_count,
    partial: r.partial_count,
    unpaid: r.unpaid_count,
    outstanding: n(r.outstanding),
  }));
  return {
    kind: "class-wise",
    title: "Class-wise fee report",
    filename: `class-wise-fees-${target}`,
    filters: { month: target, classId: classId || null },
    meta: [
      ["Month", monthLabel(target)],
      ["Class", await classLabel(actor, classId)],
      ["Note", "Billed/collected are for the month; outstanding includes every month up to it."],
    ],
    columns: [
      { key: "className", label: "Class", width: 0.15 },
      { key: "students", label: "Students", type: "number", width: 0.08 },
      { key: "billed", label: "Billed", type: "money", width: 0.12 },
      { key: "collected", label: "Collected", type: "money", width: 0.12 },
      { key: "balance", label: "Month balance", type: "money", width: 0.12 },
      { key: "paid", label: "Paid", type: "number", width: 0.07 },
      { key: "partial", label: "Partial", type: "number", width: 0.07 },
      { key: "unpaid", label: "Unpaid", type: "number", width: 0.07 },
      { key: "outstanding", label: "Outstanding to date", type: "money", width: 0.2 },
    ],
    rows,
    summary: [
      ["Students", rows.reduce((s, r) => s + r.students, 0)],
      ["Billed for the month (PKR)", money(sum(rows, "billed"))],
      ["Collected against the month (PKR)", money(sum(rows, "collected"))],
      ["Outstanding to date (PKR)", money(sum(rows, "outstanding"))],
    ],
  };
}

async function studentLedger(actor, { month, classId }) {
  const target = month || today().slice(0, 7);
  return query(
    `SELECT s.id, s.admission_no, s.first_name, s.last_name, s.status, c.label AS class_label,
            COUNT(m.id) FILTER (WHERE m.month <= :month)::int AS months_billed,
            COALESCE(SUM(m.net_amount) FILTER (WHERE m.month <= :month), 0) AS due,
            COALESCE(SUM(m.paid_amount) FILTER (WHERE m.month <= :month), 0) AS paid,
            COALESCE(SUM(GREATEST(m.net_amount - m.paid_amount, 0)) FILTER (WHERE m.month <= :month), 0) AS outstanding,
            STRING_AGG(m.month, ',' ORDER BY m.month) FILTER (WHERE m.month <= :month AND m.paid_amount < m.net_amount) AS open_months,
            COALESCE(SUM(m.paid_amount) FILTER (WHERE m.month > :month AND m.paid_amount > 0), 0) AS advance_paid,
            STRING_AGG(m.month, ',' ORDER BY m.month) FILTER (WHERE m.month > :month AND m.paid_amount > 0) AS advance_months,
            (SELECT COALESCE(SUM(p.unallocated_amount), 0) FROM fee_payments p
              WHERE p.fk_student_id = s.id AND p.archived_at IS NULL AND p.status = 'Paid') AS credit,
            (SELECT MAX(p.payment_date) FROM fee_payments p
              WHERE p.fk_student_id = s.id AND p.archived_at IS NULL AND p.status = 'Paid') AS last_payment
       FROM students s
       LEFT JOIN classes c ON c.id = s.fk_class_id
       LEFT JOIN student_fee_months m ON m.fk_student_id = s.id AND m.archived_at IS NULL
      WHERE s.fk_school_id = :schoolId AND s.archived_at IS NULL
        ${classId ? "AND s.fk_class_id = :classId" : ""}
      GROUP BY s.id, c.label
      ORDER BY c.label NULLS LAST, s.first_name, s.last_name, s.id`,
    { schoolId: actor.schoolId, month: target, classId: classId || null },
  );
}

const months = (csv) => (csv ? csv.split(",").map(monthLabel).join(", ") : "");

async function studentWise(actor, { month, classId }) {
  const target = month || today().slice(0, 7);
  const raw = await studentLedger(actor, { month: target, classId });
  const rows = raw
    .filter((r) => r.months_billed > 0 || ["Active", "Pending"].includes(r.status))
    .map((r) => ({
      admissionNo: r.admission_no,
      student: fullName(r.first_name, r.last_name),
      className: r.class_label || "",
      status: r.status,
      monthsBilled: r.months_billed,
      due: n(r.due),
      paid: n(r.paid),
      outstanding: n(r.outstanding),
      advance: n(n(r.advance_paid) + n(r.credit)),
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
      ["Note", "Advance = later months already paid plus unallocated credit."],
    ],
    columns: [
      { key: "admissionNo", label: "Admission no", width: 0.1 },
      { key: "student", label: "Student", width: 0.17 },
      { key: "className", label: "Class", width: 0.1 },
      { key: "status", label: "Status", width: 0.08 },
      { key: "monthsBilled", label: "Months", type: "number", width: 0.07 },
      { key: "due", label: "Due", type: "money", width: 0.1 },
      { key: "paid", label: "Paid", type: "money", width: 0.1 },
      { key: "outstanding", label: "Outstanding", type: "money", width: 0.1 },
      { key: "advance", label: "Advance", type: "money", width: 0.08 },
      { key: "lastPayment", label: "Last payment", width: 0.1 },
    ],
    rows,
    summary: [
      ["Students", rows.length],
      ["Due to date (PKR)", money(sum(rows, "due"))],
      ["Paid to date (PKR)", money(sum(rows, "paid"))],
      ["Outstanding (PKR)", money(sum(rows, "outstanding"))],
      ["Advance (PKR)", money(sum(rows, "advance"))],
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
      };
    })
    .sort((a, b) => b.outstanding - a.outstanding || a.student.localeCompare(b.student));
  return {
    kind: "outstanding",
    title: "Outstanding fees",
    filename: `outstanding-fees-${target}`,
    filters: { month: target, classId: classId || null },
    meta: [["Up to month", monthLabel(target)], ["Class", await classLabel(actor, classId)]],
    columns: [
      { key: "admissionNo", label: "Admission no", width: 0.11 },
      { key: "student", label: "Student", width: 0.18 },
      { key: "className", label: "Class", width: 0.11 },
      { key: "status", label: "Status", width: 0.08 },
      { key: "openMonths", label: "Open months", type: "number", width: 0.08 },
      { key: "months", label: "Unpaid months", width: 0.22 },
      { key: "oldest", label: "Oldest", width: 0.09 },
      { key: "outstanding", label: "Outstanding", type: "money", width: 0.13 },
    ],
    rows,
    summary: [
      ["Students with dues", rows.length],
      ["Total outstanding (PKR)", money(sum(rows, "outstanding"))],
    ],
  };
}

async function advanceReport(actor, { month, classId }) {
  const target = month || today().slice(0, 7);
  const raw = await studentLedger(actor, { month: target, classId });
  const rows = raw
    .filter((r) => n(r.advance_paid) > 0 || n(r.credit) > 0)
    .map((r) => ({
      admissionNo: r.admission_no,
      student: fullName(r.first_name, r.last_name),
      className: r.class_label || "",
      months: months(r.advance_months),
      prepaid: n(r.advance_paid),
      credit: n(r.credit),
      total: n(n(r.advance_paid) + n(r.credit)),
    }));
  return {
    kind: "advance",
    title: "Advance payments",
    filename: `advance-payments-${target}`,
    filters: { month: target, classId: classId || null },
    meta: [
      ["After month", monthLabel(target)],
      ["Class", await classLabel(actor, classId)],
      ["Note", "Prepaid = money already allocated to months after the selected month. Credit = receipt money not yet allocated to any month."],
    ],
    columns: [
      { key: "admissionNo", label: "Admission no", width: 0.12 },
      { key: "student", label: "Student", width: 0.2 },
      { key: "className", label: "Class", width: 0.12 },
      { key: "months", label: "Prepaid months", width: 0.22 },
      { key: "prepaid", label: "Prepaid", type: "money", width: 0.11 },
      { key: "credit", label: "Credit", type: "money", width: 0.1 },
      { key: "total", label: "Total advance", type: "money", width: 0.13 },
    ],
    rows,
    summary: [
      ["Students with advance", rows.length],
      ["Prepaid months (PKR)", money(sum(rows, "prepaid"))],
      ["Unallocated credit (PKR)", money(sum(rows, "credit"))],
      ["Total advance (PKR)", money(sum(rows, "total"))],
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
};

async function build(actor, kind, filters = {}) {
  assertKind(actor, kind);
  return BUILDERS[kind](actor, filters);
}

module.exports = { REPORT_KINDS, kindsFor, build };
