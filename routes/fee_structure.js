"use strict";

const express = require("express");
const { authorize } = require("../middlewares/authorize");
const validate = require("../middlewares/validate");
const c = require("../controllers/fee_structure");
const v = require("../validations/fee_structure");

// Super Admin edits; the accountant reads; Ops, teachers and parents get 403.
const router = express.Router();

router.get("/classes/:classId", authorize("fees.structure.read"), validate(v.validateGet), c.get);
router.get("/classes/:classId/history/:feeType", authorize("fees.structure.read"), validate(v.validateHistory), c.history);
router.post("/classes/:classId", authorize("fees.structure.update"), validate(v.validateAdd), c.add);
router.delete("/classes/:classId/:feeType", authorize("fees.structure.update"), validate(v.validateRemove), c.remove);

module.exports = router;
