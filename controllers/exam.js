"use strict";

const { examService, documentService } = require("../services");
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
  dmc: async (req, res, next) => {
    try {
      if (req.query.format === "pdf") {
        const buffer = await documentService.dmcPdf(req.user, req.params.id, req.query.studentId);
        res.set("Content-Type", "application/pdf");
        res.set("Content-Disposition", "inline; filename=\"dmc.pdf\"");
        return res.send(buffer);
      }
      const data = await examService.dmc(req.user, req.params.id, req.query.studentId);
      return res.status(200).json({ success: true, message: "Detailed marks certificate", data });
    } catch (err) {
      return next(err);
    }
  },
};
