"use strict";

/**
 * Server-side permission matrix (SRS Addendum v1.1, UR-01 / BR-14).
 * Every protected route declares one of these capabilities; menus in the
 * front end are only a convenience, this map is the source of truth.
 */
const { USER_ROLES } = require("./index");

const SA = USER_ROLES.SUPER_ADMIN;
const OPS = USER_ROLES.OPERATIONS_MANAGER;
const ACC = USER_ROLES.ACCOUNTANT;
const TCH = USER_ROLES.TEACHER;
const PAR = USER_ROLES.PARENT;

const PERMISSIONS = {
  "account.self": [SA, OPS, ACC, TCH, PAR],
  "school.read": [SA, OPS, ACC, TCH, PAR],
  "school.update": [SA],
  "settings.read": [SA, OPS],
  "settings.academic.update": [SA, OPS],
  "settings.fees.update": [SA],
  "audit.read": [SA, OPS], // Ops: read-only; fee entries are filtered out for roles without fees.amounts.read

  "users.read": [SA, OPS],
  "users.create": [SA, OPS],

  "academic.read": [SA, OPS, ACC, TCH, PAR],
  "academic.manage": [SA, OPS],

  "teachers.read": [SA, OPS, TCH],
  "teachers.manage": [SA, OPS],
  "teachers.self": [TCH],

  "students.read": [SA, OPS, ACC, TCH, PAR],
  "students.manage": [SA, OPS],
  "leave.read": [SA, OPS, TCH, PAR],
  "leave.request": [SA, OPS, PAR],
  "leave.review": [SA, OPS],
  "reports.dashboard": [SA, OPS, TCH, PAR],
  "parents.manage": [SA, OPS],
  "admissions.manage": [SA, OPS],
  "documents.read": [SA, OPS, PAR],

  "attendance.read": [SA, OPS, TCH, PAR],
  "attendance.mark": [SA, OPS, TCH],
  "attendance.review": [SA, OPS],
  "attendance.edit": [SA, OPS],

  "timetable.read": [SA, OPS, TCH, PAR],
  "timetable.manage": [SA, OPS],

  "absences.read": [SA, OPS, TCH],
  "absences.manage": [SA, OPS],

  "chapters.read": [SA, OPS, TCH],
  "chapters.manage": [SA, OPS],
  "lessons.read": [SA, OPS, TCH, PAR],
  "lessons.write": [TCH],
  "lessons.review": [SA, OPS],

  "tests.read": [SA, OPS, TCH, PAR],
  "tests.schedule": [SA, OPS],
  "tests.marks": [SA, OPS, TCH],
  "tests.publish": [SA, OPS],

  "exams.read": [SA, OPS, TCH, PAR],
  "exams.create": [SA, OPS],
  "exams.marks": [SA, OPS, TCH],
  "exams.verify": [SA, OPS],
  "exams.publish": [SA, OPS],
  "results.override": [SA, OPS],
  "results.parent": [PAR],

  "fees.months.read": [SA, ACC, PAR],
  "fees.months.generate": [SA, ACC],
  "fees.payments.read": [SA, ACC, PAR],
  "fees.payments.record": [SA, ACC],
  "fees.payments.allocate_manual": [SA],
  "fees.payments.confirm": [SA],
  "fees.collections.mine": [ACC],
  "fees.totals": [SA],
  // Fee amounts embedded in non-fee responses (class fee, strike-off dues, audit
  // entries). Everyone else gets them stripped by middlewares/redact_fee_fields.
  "fees.amounts.read": [SA, ACC, PAR],
  // Fee reports: Super Admin gets every report with totals; the accountant only their own
  // daily collections without totals (enforced again in fee_report.service).
  "fees.reports": [SA, ACC],

  // Finance (Step 8): the accountant records expenses and lists only their own entries,
  // without totals (enforced again in expense.service). Income and reports: Super Admin.
  "expenses.read": [SA, ACC],
  "expenses.create": [SA, ACC],
  "expenses.manage": [SA],
  "finance.reports": [SA],

  // Finance Step 2 scaffolding (routes come in later steps). Ops and Teachers get none.
  "fees.structure.read": [SA, ACC], // accountant: read-only fee structure
  "fees.structure.update": [SA],
  "fees.credit.read": [SA, ACC, PAR],
  "fees.import": [SA, ACC], // offline sync (Excel import) + its upload history
  "income.read": [SA],
  "income.create": [SA],
  "income.manage": [SA],

  "updates.read": [SA, OPS, ACC, TCH, PAR],
  "updates.write": [SA, OPS, TCH],
  "updates.review": [SA, OPS],
};

function rolesFor(permission) {
  const roles = PERMISSIONS[permission];
  if (!roles) throw new Error(`Unknown permission "${permission}"`);
  return roles;
}

function can(role, permission) {
  return rolesFor(permission).includes(role);
}

module.exports = { PERMISSIONS, rolesFor, can };
