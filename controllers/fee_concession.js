"use strict";

const feeConcessionService = require("../services/fee_concession.service");
const feeStructureService = require("../services/fee_structure.service");
const feeService = require("../services/fee.service");
const { Students } = require("../models");
const { handle } = require("../utils/handler");
const ApiError = require("../utils/ApiError");

module.exports = {
  create: handle("Concession draft created", (req) => feeConcessionService.create(req.user, req.body), 201),
  list: handle("Fee concessions", (req) => feeConcessionService.list(req.user.schoolId, req.query)),
  get: handle("Concession", (req) => feeConcessionService.get(req.user.schoolId, req.params.id)),
  listForStudent: handle("Student concessions", (req) => feeConcessionService.listForStudent(req.user.schoolId, req.params.studentId)),
  submit: handle("Concession submitted", (req) => feeConcessionService.submit(req.user, req.params.id)),
  approve: handle("Concession approved", (req) => feeConcessionService.approve(req.user, req.params.id)),
  reject: handle("Concession rejected", (req) => feeConcessionService.reject(req.user, req.params.id, req.body.reason)),
  revoke: handle("Concession revoked", (req) => feeConcessionService.revoke(req.user, req.params.id, req.body.reason)),
  breakdown: handle("Fee breakdown", async (req) => {
    const student = await Students.findOne({
      where: { id: req.params.studentId, fkSchoolId: req.user.schoolId },
    });
    if (!student) throw new ApiError(404, "Student not found");
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
      base = map.get(feeType) ? Number(map.get(feeType).amount) : 0;
    }
    const resolved = await feeConcessionService.resolveForBill(
      req.user.schoolId,
      student,
      feeType,
      base,
      `${month}-01`,
    );
    return {
      studentId: student.id,
      month,
      feeType,
      base,
      discount: resolved.discount,
      net: resolved.net,
      conflict: resolved.conflict,
      snapshot: resolved.snapshot,
    };
  }),
};
