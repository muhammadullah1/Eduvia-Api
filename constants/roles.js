"use strict";

const { USER_ROLES } = require("./index");

const PORTALS = { ADMIN: "admin", TEACHER: "teacher", PARENT: "parent" };

/** The five system roles every school starts with (seeded per school). */
const SYSTEM_ROLES = [
  {
    key: USER_ROLES.SUPER_ADMIN,
    label: "Super Admin",
    description: "Full control of the school, including fee totals and roles.",
    portal: PORTALS.ADMIN,
  },
  {
    key: USER_ROLES.OPERATIONS_MANAGER,
    label: "Operations Manager",
    description: "Academics, people, attendance and results — no fee amounts.",
    portal: PORTALS.ADMIN,
  },
  {
    key: USER_ROLES.ACCOUNTANT,
    label: "Accountant",
    description: "Records payments and prints own daily receipts — never totals.",
    portal: PORTALS.ADMIN,
  },
  {
    key: USER_ROLES.TEACHER,
    label: "Teacher",
    description: "Own classes, attendance, lessons and marks in the teacher portal.",
    portal: PORTALS.TEACHER,
  },
  {
    key: USER_ROLES.PARENT,
    label: "Parent",
    description: "Read-only view of own children in the parent portal.",
    portal: PORTALS.PARENT,
  },
];

/** Roles that share the one staff portal and whose users can be moved between them. */
const STAFF_PORTAL_ROLES = SYSTEM_ROLES.filter((role) => role.portal === PORTALS.ADMIN).map((role) => role.key);

module.exports = { PORTALS, SYSTEM_ROLES, STAFF_PORTAL_ROLES };
