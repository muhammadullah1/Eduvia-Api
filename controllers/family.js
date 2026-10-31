"use strict";

const familyService = require("../services/family.service");
const { handle } = require("../utils/handler");

module.exports = {
  create: handle("Family created", (req) => familyService.create(req.user, req.body), 201),
  list: handle("Families", (req) => familyService.list(req.user.schoolId)),
  get: handle("Family", (req) => familyService.get(req.user.schoolId, req.params.id)),
  verify: handle("Family verified", (req) => familyService.verify(req.user, req.params.id)),
  addMember: handle("Family member added", (req) => familyService.addMember(req.user, req.params.id, req.body)),
  removeMember: handle("Family member removed", (req) => familyService.removeMember(req.user, req.params.id, req.params.studentId)),
  suggest: handle("Family suggestions", (req) => familyService.suggestMembers(req.user.schoolId, req.params.id)),
};
