"use strict";

const { roleService } = require("../services");
const { handle } = require("../utils/handler");

module.exports = {
  catalog: handle("Permission catalog", () => roleService.catalog()),
  list: handle("Roles", (req) => roleService.list(req.user.schoolId)),
  get: handle("Role", (req) => roleService.get(req.user.schoolId, req.params.id)),
  updatePermissions: handle("Permissions updated", (req) => roleService.updatePermissions(req.user, req.params.id, req.body)),
  reset: handle("Permissions reset to default", (req) => roleService.resetToDefault(req.user, req.params.id, req.body)),
  users: handle("Role users", (req) => roleService.listUsers(req.user.schoolId, req.params.id)),
  changeUserRole: handle("Role changed", (req) => roleService.changeUserRole(req.user, req.params.userId, req.body)),
};
