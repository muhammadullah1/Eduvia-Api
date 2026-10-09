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
  "audit.read": [SA],

  "users.read": [SA, OPS],
  "users.create": [SA, OPS],

  "academic.read": [SA, OPS, ACC, TCH, PAR],
  "academic.manage": [SA, OPS],

  "teachers.read": [SA, OPS, TCH],
  "teachers.manage": [SA, OPS],
  "teachers.self": [TCH],

  "students.read": [SA, OPS, ACC, TCH, PAR],
  "students.manage": [SA, OPS],
  "parents.manage": [SA, OPS],
  "admissions.manage": [SA, OPS],

  "attendance.read": [SA, OPS, TCH, PAR],
  "attendance.mark": [SA, OPS, TCH],

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

  "fees.months.read": [SA, OPS, ACC, PAR],
  "fees.months.generate": [SA, ACC],
  "fees.payments.read": [SA, ACC, PAR],
  "fees.payments.record": [SA, ACC],
  "fees.payments.allocate_manual": [SA],
  "fees.payments.confirm": [SA],
  "fees.collections.mine": [ACC],
  "fees.totals": [SA],

  "expenses.read": [SA, OPS, ACC],
  "expenses.create": [SA, ACC],
  "expenses.manage": [SA],

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
