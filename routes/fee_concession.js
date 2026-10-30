"use strict";

const express = require("express");
const { authorize } = require("../middlewares/authorize");
const validate = require("../middlewares/validate");
const c = require("../controllers/fee_concession");
const v = require("../validations/fee_concession");

const router = express.Router();

router.post("/", authorize("fees.concessions.request"), validate(v.validateCreate), c.create);
router.get("/", authorize("fees.concessions.read"), c.list);
router.get(
  "/students/:studentId",
  authorize("fees.concessions.read"),
  validate(v.validateStudent),
  c.listForStudent,
);
router.get(
  "/students/:studentId/siblings",
  authorize("fees.concessions.read"),
  validate(v.validateStudent),
  c.siblingSuggestion,
);
router.get(
  "/students/:studentId/breakdown",
  authorize("fees.concessions.read"),
  validate(v.validateBreakdown),
  c.breakdown,
);
router.get("/:id", authorize("fees.concessions.read"), validate(v.validateId), c.get);
router.post("/:id/approve", authorize("fees.concessions.approve"), validate(v.validateId), c.approve);
router.post("/:id/reject", authorize("fees.concessions.approve"), validate(v.validateReject), c.reject);
router.post("/:id/revoke", authorize("fees.concessions.approve"), validate(v.validateReject), c.revoke);

module.exports = router;
