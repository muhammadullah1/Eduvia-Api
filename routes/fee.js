"use strict";

const express = require("express");
const { authorize } = require("../middlewares/authorize");
const validate = require("../middlewares/validate");
const { feeController: c } = require("../controllers");
const v = require("../validations/fee");

const router = express.Router();

router.post("/months/generate", authorize("fees.months.generate"), validate(v.validateGenerate), c.generateMonths);
router.get("/months", authorize("fees.months.read"), validate(v.validateMonths), c.listMonths);
router.get("/payments", authorize("fees.payments.read"), validate(v.validateList), c.listPayments);
router.post("/payments", authorize("fees.payments.record"), validate(v.validateRecord), c.recordPayment);
router.post("/payments/import", authorize("fees.payments.record"), validate(v.validateImport), c.importPayments);
router.get("/payments/:id/receipt", authorize("fees.payments.read"), validate(v.validateId), c.receipt);
router.post("/payments/:id/confirm", authorize("fees.payments.confirm"), validate(v.validateId), c.confirmPayment);
router.get("/collections/mine", authorize("fees.collections.mine"), validate(v.validateDay), c.myCollections);
router.get("/collections", authorize("fees.totals"), validate(v.validateCollections), c.collections);
router.get("/summary", authorize("fees.totals"), validate(v.validateSummary), c.summary);

module.exports = router;
