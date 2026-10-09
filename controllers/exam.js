"use strict";

const { examService } = require("../services");
const { handle } = require("../utils/handler");

module.exports = {
  list: handle("Exams", (req) => examService.list(req.user, req.query)),
  getById: handle("Exam", (req) => examService.getExam(req.user, req.params.id)),
  create: handle("Exam created", (req) => examService.create(req.user, req.body), 201),
  getSheet: handle("Mark sheet", (req) => examService.getSheet(req.user, req.params.sheetId)),
  updateRows: handle("Scores saved", (req) => examService.updateRows(req.user, req.params.sheetId, req.body.rows)),
  submit: handle("Sheet submitted", (req) => examService.transition(req.user, req.params.sheetId, "submit")),
  verify: handle("Sheet verified", (req) => examService.transition(req.user, req.params.sheetId, "verify")),
  publish: handle("Sheet published", (req) => examService.transition(req.user, req.params.sheetId, "publish")),
  reopen: handle("Sheet reopened", (req) => examService.transition(req.user, req.params.sheetId, "reopen")),
  gateStatus: handle("Result visibility", (req) => examService.gateStatus(req.user, req.params.id)),
  listOverrides: handle("Result overrides", (req) => examService.listOverrides(req.user, req.query)),
  grantOverride: handle("Result released", (req) => examService.grantOverride(req.user, req.params.id, req.body), 201),
  revokeOverride: handle("Override revoked", (req) => examService.revokeOverride(req.user, req.params.overrideId)),
  parentResults: handle("Results", (req) => examService.parentResults(req.user, req.query.studentId)),
};
