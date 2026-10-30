"use strict";

/**
 * Staff dashboard (EDUVIA-16 Phase 2): one school-scoped, permission-shaped payload.
 * Every widget is built only when the caller holds its permission, so redaction is
 * enforced here, not in the interface. Money figures reuse the finance ledger and the
 * finance report, so the dashboard reconciles with Reports and Finance by construction.
 * The Accountant receives row data and counts only, never a money aggregate (BR-11).
 */
const { USER_ROLES, STUDENT_STATUS, SHEET_STATUS } = require("../constants");
const { attendancePercent } = require("../utils/attendance");
const { today } = require("../utils/dates");
const ApiError = require("../utils/ApiError");
const { parsePeriod, currentPeriods, shortMonth } = require("../utils/finance_period");
const { hasPermission } = require("./permission.service");
const feeService = require("./fee.service");
const financeService = require("./finance.service");
const L = require("./finance_ledger");

const CACHE_MS = 30 * 1000;
const TREND_DAYS = 7;
const TOP_DEFAULTER_CLASSES = 5;
const RECENT_PAYMENTS = 5;
const RECENT_IMPORTS = 5;
const PORTAL_ROLES = new Set([USER_ROLES.TEACHER, USER_ROLES.PARENT]);

const cache = new Map();

function sweep() {
  const now = Date.now();
  for (const [key, entry] of cache) if (entry.expires <= now) cache.delete(key);
}

const count = async (sql, replacements) => {
  const rows = await L.query(sql, replacements);
  return rows.reduce((sum, row) => sum + Number(row.n), 0);
};

function fullCount(rows, status) {
  return rows.filter((row) => row.status === status).reduce((sum, row) => sum + Number(row.n), 0);
}

function attendanceOf(rows) {
  return attendancePercent({ present: fullCount(rows, "Present"), late: fullCount(rows, "Late"), absent: fullCount(rows, "Absent") });
}

async function students(schoolId) {
  return {
    active: await count(`SELECT COUNT(*)::int n FROM students WHERE fk_school_id = :schoolId AND archived_at IS NULL AND status = :status`, { schoolId, status: STUDENT_STATUS.ACTIVE }),
  };
}

async function teachers(schoolId) {
  return {
    active: await count(`SELECT COUNT(*)::int n FROM teachers WHERE fk_school_id = :schoolId AND archived_at IS NULL AND status = 'Active'`, { schoolId }),
  };
}

async function attendance(schoolId, day) {
  const rows = await L.query(
    `SELECT date::text AS day, status, COUNT(*)::int n FROM attendances
      WHERE fk_school_id = :schoolId AND archived_at IS NULL AND date > (:day::date - :days::int) AND date <= :day::date
      GROUP BY 1, 2`,
    { schoolId, day, days: TREND_DAYS },
  );
  const todays = rows.filter((row) => row.day === day);
  const days = [...new Set(rows.map((row) => row.day))].sort();
  return {
    today: {
      marked: todays.reduce((sum, row) => sum + Number(row.n), 0),
      present: fullCount(todays, "Present") + fullCount(todays, "Late"),
      absent: fullCount(todays, "Absent"),
      leave: fullCount(todays, "Leave"),
      percent: attendanceOf(todays),
    },
    trend: days.map((d) => ({ date: d, percent: attendanceOf(rows.filter((row) => row.day === d)) })),
  };
}

async function absentTeachers(schoolId, day) {
  const rows = await L.query(
    `SELECT a.fk_teacher_id AS id, u.first_name, u.last_name,
            COUNT(*)::int AS periods,
            COUNT(*) FILTER (WHERE a.status = 'Covered')::int AS covered,
            COUNT(*) FILTER (WHERE a.status = 'Pending')::int AS uncovered
       FROM teacher_absences a
       JOIN teachers t ON t.id = a.fk_teacher_id
       JOIN users u ON u.id = t.fk_user_id
      WHERE a.fk_school_id = :schoolId AND a.archived_at IS NULL AND a.date = :day AND a.status <> 'Cancelled'
      GROUP BY 1, 2, 3
      ORDER BY uncovered DESC, 2`,
    { schoolId, day },
  );
  return rows.map((row) => ({ teacherId: row.id, name: L.fullName(row.first_name, row.last_name), periods: row.periods, covered: row.covered, uncovered: row.uncovered }));
}

async function pending(actor) {
  const schoolId = actor.schoolId;
  const items = {};
  if (hasPermission(actor, "lessons.review")) {
    items.lessonReviews = await count(`SELECT COUNT(*)::int n FROM daily_lessons WHERE fk_school_id = :schoolId AND archived_at IS NULL AND review_status = 'Submitted'`, { schoolId });
  }
  if (hasPermission(actor, "exams.verify")) {
    items.marksToVerify = await count(`SELECT COUNT(*)::int n FROM mark_sheets WHERE fk_school_id = :schoolId AND archived_at IS NULL AND status = :status`, { schoolId, status: SHEET_STATUS.SUBMITTED });
  }
  if (hasPermission(actor, "exams.publish")) {
    items.resultsToPublish = await count(`SELECT COUNT(*)::int n FROM mark_sheets WHERE fk_school_id = :schoolId AND archived_at IS NULL AND status = :status`, { schoolId, status: SHEET_STATUS.VERIFIED });
  }
  if (hasPermission(actor, "fees.concessions.approve")) {
    items.concessions = await count(`SELECT COUNT(*)::int n FROM student_fee_concessions WHERE fk_school_id = :schoolId AND archived_at IS NULL AND status = 'PendingApproval'`, { schoolId });
  }
  if (hasPermission(actor, "fees.months.adjust")) {
    items.adjustments = await count(`SELECT COUNT(*)::int n FROM student_fee_month_adjustments WHERE fk_school_id = :schoolId AND status = 'PendingApproval'`, { schoolId });
  }
  return items;
}

/** Fee-cleared yes/no (nothing owed up to the current month), as student counts only. */
async function feeStatus(schoolId, month) {
  const rows = await L.query(
    `SELECT s.id, bool_and(m.status IN ('Paid', 'Advance')) AS cleared
       FROM student_fee_months m
       JOIN students s ON s.id = m.fk_student_id AND s.archived_at IS NULL AND s.status = :status
      WHERE m.fk_school_id = :schoolId AND m.archived_at IS NULL AND m.month <= :month
      GROUP BY s.id`,
    { schoolId, month, status: STUDENT_STATUS.ACTIVE },
  );
  return { month, label: shortMonth(month), cleared: rows.filter((row) => row.cleared).length, notCleared: rows.filter((row) => !row.cleared).length };
}

/** Super Admin money widgets for the period (fee totals); reconciles with Finance and fee reports. */
async function finance(actor, period, month) {
  const schoolId = actor.schoolId;
  const chartFrom = `${period.chartMonths.at(0)}-01`;
  const [byMonth, billed, outstanding, methods, defaulters, recent] = await Promise.all([
    L.feeIncomeByMonth(schoolId, chartFrom, period.to),
    L.query(
      `SELECT COALESCE(SUM(COALESCE(collectible_amount, net_amount)), 0) AS expected, COALESCE(SUM(paid_amount), 0) AS paid
         FROM student_fee_months WHERE fk_school_id = :schoolId AND archived_at IS NULL AND month IN (:months)`,
      { schoolId, months: period.months },
    ),
    L.query(
      `SELECT COALESCE(SUM(GREATEST(COALESCE(collectible_amount, net_amount) - paid_amount, 0)), 0) AS amount
         FROM student_fee_months WHERE fk_school_id = :schoolId AND archived_at IS NULL AND month <= :month`,
      { schoolId, month },
    ),
    L.query(
      `SELECT p.payment_method AS method, COALESCE(SUM(p.amount_paid), 0) AS amount, COUNT(*)::int AS receipts
         FROM fee_payments p WHERE ${L.FEE_INCOME_WHERE} AND p.payment_date >= :from AND p.payment_date < :to
        GROUP BY 1 ORDER BY 2 DESC`,
      { schoolId, from: period.from, to: period.to },
    ),
    L.query(
      `SELECT c.id, c.label, COUNT(DISTINCT m.fk_student_id)::int AS students,
              SUM(GREATEST(COALESCE(m.collectible_amount, m.net_amount) - m.paid_amount, 0)) AS amount
         FROM student_fee_months m
         JOIN students s ON s.id = m.fk_student_id
         JOIN classes c ON c.id = s.fk_class_id
        WHERE m.fk_school_id = :schoolId AND m.archived_at IS NULL AND m.month <= :month
          AND COALESCE(m.collectible_amount, m.net_amount) > m.paid_amount
        GROUP BY 1, 2 ORDER BY 4 DESC LIMIT :limit`,
      { schoolId, month, limit: TOP_DEFAULTER_CLASSES },
    ),
    L.query(
      `SELECT p.id, p.receipt_no, p.payment_date::text AS payment_date, p.payment_method, p.amount_paid, s.first_name, s.last_name, c.label AS class_label
         FROM fee_payments p JOIN students s ON s.id = p.fk_student_id LEFT JOIN classes c ON c.id = s.fk_class_id
        WHERE ${L.FEE_INCOME_WHERE} ORDER BY p.payment_date DESC, p.id DESC LIMIT :limit`,
      { schoolId, limit: RECENT_PAYMENTS },
    ),
  ]);
  const collected = period.months.reduce((sum, m) => sum + L.cents(byMonth[m]?.amount), 0);
  const bills = billed.at(0);
  const expected = L.cents(bills.expected);
  return {
    collected: L.fromCents(collected),
    expected: L.fromCents(expected),
    paidAgainstBills: L.fromCents(L.cents(bills.paid)),
    collectionRate: L.percent(L.cents(bills.paid), expected),
    outstanding: L.fromCents(L.cents(outstanding.at(0).amount)),
    trend: period.chartMonths.map((m) => ({ month: m, label: shortMonth(m), amount: L.fromCents(L.cents(byMonth[m]?.amount)) })),
    byMethod: methods.map((row) => ({ method: row.method, amount: Number(row.amount), receipts: row.receipts })),
    defaulterClasses: defaulters.map((row) => ({ classId: row.id, label: row.label, students: row.students, amount: Number(row.amount) })),
    recentPayments: recent.map((row) => ({
      id: row.id,
      receiptNo: row.receipt_no,
      date: row.payment_date,
      method: row.payment_method,
      amount: Number(row.amount_paid),
      studentName: L.fullName(row.first_name, row.last_name),
      classLabel: row.class_label,
    })),
  };
}

async function incomeVsExpenses(actor, period) {
  const report = await financeService.report(actor, { period: period.key });
  return { income: report.totals.income, expenses: report.totals.expenses, net: report.totals.net };
}

async function alerts(schoolId) {
  const [noStructure, failedImports] = await Promise.all([
    L.query(
      `SELECT c.id, c.label FROM classes c
         JOIN academic_sessions s ON s.id = c.fk_session_id AND s.is_current
        WHERE c.fk_school_id = :schoolId AND c.archived_at IS NULL AND c.status = 'Active'
          AND NOT EXISTS (SELECT 1 FROM fee_structures f WHERE f.fk_class_id = c.id AND f.fk_session_id = c.fk_session_id AND f.archived_at IS NULL)
        ORDER BY c.label`,
      { schoolId },
    ),
    count(`SELECT COUNT(*)::int n FROM fee_import_batches WHERE fk_school_id = :schoolId AND status = 'Failed'`, { schoolId }),
  ]);
  return { classesWithoutFeeStructure: noStructure.map((row) => ({ classId: row.id, label: row.label })), failedImports };
}

/** Bill generation for the current month as counts of students (no money). */
async function generation(schoolId, month) {
  const rows = await L.query(
    `SELECT COUNT(*)::int AS active,
            COUNT(*) FILTER (WHERE EXISTS (
              SELECT 1 FROM student_fee_months m WHERE m.fk_student_id = s.id AND m.month = :month AND m.archived_at IS NULL))::int AS billed
       FROM students s WHERE s.fk_school_id = :schoolId AND s.archived_at IS NULL AND s.status = :status`,
    { schoolId, month, status: STUDENT_STATUS.ACTIVE },
  );
  const row = rows.at(0);
  return { month, label: shortMonth(month), activeStudents: row.active, billed: row.billed, notBilled: row.active - row.billed };
}

/** The caller's own offline uploads, without the batch money total. */
async function myImports(actor) {
  const rows = await L.query(
    `SELECT id, file_name, status, total_rows, imported_rows, error_rows, duplicate_rows, created_at
       FROM fee_import_batches WHERE fk_school_id = :schoolId AND fk_uploaded_by_user_id = :userId
      ORDER BY created_at DESC LIMIT :limit`,
    { schoolId: actor.schoolId, userId: actor.id, limit: RECENT_IMPORTS },
  );
  return rows.map((row) => ({
    id: row.id,
    fileName: row.file_name,
    status: row.status,
    totalRows: row.total_rows,
    importedRows: row.imported_rows,
    errorRows: row.error_rows,
    duplicateRows: row.duplicate_rows,
    uploadedAt: new Date(row.created_at).toISOString(),
  }));
}

async function myReceiptsToday(actor) {
  const sheet = await feeService.myCollections(actor, {});
  return { date: sheet.date, rows: sheet.rows };
}

async function build(actor, period) {
  const schoolId = actor.schoolId;
  const day = today();
  const month = currentPeriods(day).month;
  const can = (key) => hasPermission(actor, key);
  const widgets = {};
  if (can("students.read") && can("reports.dashboard")) widgets.students = await students(schoolId);
  if (can("teachers.read") && can("reports.dashboard")) widgets.teachers = await teachers(schoolId);
  if (can("attendance.review")) widgets.attendance = await attendance(schoolId, day);
  if (can("absences.read") && can("reports.dashboard")) widgets.absentTeachers = await absentTeachers(schoolId, day);
  if (can("reports.dashboard")) widgets.pending = await pending(actor);
  if (can("students.manage") && !can("fees.totals")) widgets.feeStatus = await feeStatus(schoolId, month);
  if (can("fees.totals")) widgets.finance = await finance(actor, period, month);
  if (can("income.read") && can("finance.reports")) widgets.incomeVsExpenses = await incomeVsExpenses(actor, period);
  if (can("fees.totals") && can("fees.structure.read")) widgets.alerts = await alerts(schoolId);
  if (can("fees.collections.mine")) widgets.myReceiptsToday = await myReceiptsToday(actor);
  if (can("fees.months.generate")) widgets.generation = await generation(schoolId, month);
  if (can("fees.import") && !can("fees.totals")) widgets.myImports = await myImports(actor);
  return { period: { key: period.key, kind: period.kind, label: period.label, from: period.from, to: period.to }, today: day, widgets, generatedAt: new Date().toISOString() };
}

/** GET /dashboard?period=YYYY-MM | YYYY-Qn | FYyyyy, cached briefly per school, user and period. */
async function dashboard(actor, { period } = {}) {
  if (PORTAL_ROLES.has(actor.role)) throw new ApiError(403, "Teachers and parents use their own portal home page.");
  const parsed = parsePeriod(period || currentPeriods().month);
  const grants = [...actor.permissions].sort().join(",");
  const key = `${actor.schoolId}:${actor.id}:${parsed.key}:${grants}`;
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;
  sweep();
  const value = await build(actor, parsed);
  cache.set(key, { value, expires: Date.now() + CACHE_MS });
  return value;
}

/** Drops every cached payload (tests and data fixes that must show at once). */
function clearCache() {
  cache.clear();
}

module.exports = { dashboard, clearCache };
