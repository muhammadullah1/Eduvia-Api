"use strict";

const { USER_ROLES } = require("./index");

const PORTAL_BY_ROLE = {
  [USER_ROLES.SUPER_ADMIN]: {
    slug: "admin",
    label: "Super Admin Portal",
    defaultSection: "dashboard",
  },
  [USER_ROLES.OPERATIONS_MANAGER]: {
    slug: "operations",
    label: "Operations Portal",
    defaultSection: "overview",
  },
  [USER_ROLES.ACCOUNTANT]: {
    slug: "accountant",
    label: "Accountant Portal",
    defaultSection: "collect",
  },
  [USER_ROLES.TEACHER]: {
    slug: "teacher",
    label: "Teacher Portal",
    defaultSection: "today",
  },
  [USER_ROLES.PARENT]: {
    slug: "parent",
    label: "Parent Portal",
    defaultSection: "home",
  },
};

function getPortalForRole(role) {
  return PORTAL_BY_ROLE[role] || null;
}

function assertPortalRole(role) {
  return Boolean(getPortalForRole(role));
}

module.exports = {
  PORTAL_BY_ROLE,
  getPortalForRole,
  assertPortalRole,
};
