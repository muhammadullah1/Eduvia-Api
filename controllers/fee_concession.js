"use strict";

const feeConcessionService = require("../services/fee_concession.service");
const feeStructureService = require("../services/fee_structure.service");
const feeService = require("../services/fee.service");
const accessService = require("../services/access.service");
const { handle } = require("../utils/handler");

module.exports = {
  create: handle("Concession saved", async (req) => feeConcessionService.assign(req.user, req.body), 201),
  list: handle("Fee concessions", async (req) => feeConcessionService.list(req.user, req.query)),
  get: handle("Concession", async (req) => feeConcessionService.get(req.user, req.params.id)),
  listForStudent: handle("Student concessions", async (req) =>
    feeConcessionService.listForStudent(req.user, req.params.studentId),
  ),
  siblingSuggestion: handle("Sibling suggestion", async (req) =>
    feeConcessionService.siblingSuggestion(req.user, req.params.studentId),
  ),
  approve: handle("Concession approved", async (req) =>
    feeConcessionService.approve(req.user, req.params.id),
  ),
  reject: handle("Concession rejected", async (req) =>
    feeConcessionService.reject(req.user, req.params.id, req.body.reason),
  ),
  revoke: handle("Concession revoked", async (req) =>
    feeConcessionService.revoke(req.user, req.params.id, req.body.reason),
  ),
  breakdown: handle("Fee breakdown", async (req) => {
    const student = await accessService.assertStudentAccess(req.user, req.params.studentId);
    const month = req.query.month;
    const feeType = req.query.feeType || "Tuition";
    let base;
    if (feeType === "Tuition") {
      base = await feeService.monthlyFeeFor(req.user.schoolId, student, undefined, month);
    } else {
      const onDay = `${month}-01`;
      const map = student.fkClassId
        ? await feeStructureService.inForce(student.fkClassId, onDay, { feeType })
        : new Map();
      const row = map.get(feeType);
      base = row && Number(row.amount) > 0 ? Number(row.amount) : null;
    }
    const resolved = await feeConcessionService.resolveForBill(
      req.user.schoolId,
      student,
      feeType,
      base == null ? 0 : base,
      `${month}-01`,
    );
    return {
      studentId: student.id,
      month,
      feeType,
      base: base == null ? null : Number(base),
      discount: resolved.discount,
      net: base == null ? null : resolved.net,
      conflict: false,
      snapshot: resolved.snapshot,
    };
  }),
};
