"use strict";

const express = require("express");
const { authorize } = require("../middlewares/authorize");
const validate = require("../middlewares/validate");
const { financeController: c } = require("../controllers");
const v = require("../validations/finance");
const vi = require("../validations/other_income");

/** Finance (Step 8): Super Admin only. Expenses live under /expenses (accountant may record). */
const router = express.Router();

router.get("/income", authorize("income.read"), validate(v.validatePeriod), c.income);
router.post("/income", authorize("income.create"), validate(vi.validateCreate), c.createIncome);
router.patch("/income/:id", authorize("income.manage"), validate(vi.validateUpdate), c.updateIncome);
router.delete("/income/:id", authorize("income.manage"), validate(vi.validateRemove), c.removeIncome);
router.get("/report", authorize("finance.reports"), validate(v.validatePeriod), c.report);
router.get("/report/export", authorize("finance.reports"), validate(v.validateExport), c.exportReport);

module.exports = router;
