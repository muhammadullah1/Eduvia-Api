"use strict";

const express = require("express");
const { authorize } = require("../middlewares/authorize");
const validate = require("../middlewares/validate");
const { feeController: c } = require("../controllers");
const v = require("../validations/fee");

const router = express.Router();

router.post("/months/preview", authorize("fees.months.generate"), validate(v.validateGenerate), c.previewGeneration);
router.post("/months/generate", authorize("fees.months.generate"), validate(v.validateGenerate), c.generateMonths);
router.get("/students/:studentId/ledger", authorize("fees.months.read"), validate(v.validateLedger), c.studentLedger);
router.get("/months", authorize("fees.months.read"), validate(v.validateMonths), c.listMonths);
router.get("/payments", authorize("fees.payments.read"), validate(v.validateList), c.listPayments);
router.get("/collect/overview", authorize("fees.payments.record"), c.collectOverview);
router.get("/collect/students", authorize("fees.payments.record"), validate(v.validateCollectSearch), c.searchStudents);
router.get("/collect/students/:studentId", authorize("fees.payments.record"), validate(v.validateCollectStudent), c.collectContext);
router.post("/payments/preview", authorize("fees.payments.record"), validate(v.validateRecord), c.previewPayment);
router.post("/payments", authorize("fees.payments.record"), validate(v.validateRecord), c.recordPayment);
router.get("/payments/:id/receipt", authorize("fees.payments.read"), validate(v.validateId), c.receipt);
router.post("/payments/:id/confirm", authorize("fees.payments.confirm"), validate(v.validateId), c.confirmPayment);
router.get("/collections/mine", authorize("fees.collections.mine"), validate(v.validateDay), c.myCollections);
router.get("/collections", authorize("fees.totals"), validate(v.validateCollections), c.collections);
router.get("/reports/concessions-given", authorize("fees.reports"), async (req, res, next) => {
  try {
    const concessionReportService = require("../services/concession_report.service");
    const data = await concessionReportService.report(req.user.schoolId, {
      month: req.query.month,
      classId: req.query.classId,
      reasonId: req.query.reasonId,
    });
    res.json({ success: true, message: "Concessions given", data });
  } catch (err) {
    next(err);
  }
});
router.get("/reports/:kind", authorize("fees.reports"), validate(v.validateReport), c.report);
router.get("/import-template", authorize("fees.import"), c.importTemplate);
// Offline sync (Step 7): validate -> commit (Idempotency-Key header) -> history / error report.
router.get("/imports", authorize("fees.import"), validate(v.validateImportHistory), c.importHistory);
router.post("/imports/validate", authorize("fees.import"), validate(v.validateImportFile), c.validateImport);
router.get("/imports/:id", authorize("fees.import"), validate(v.validateId), c.importDetail);
router.post("/imports/:id/commit", authorize("fees.import"), validate(v.validateId), c.commitImport);
router.post("/imports/:id/discard", authorize("fees.import"), validate(v.validateId), c.discardImport);
router.get("/imports/:id/error-report", authorize("fees.import"), validate(v.validateId), c.importErrorReport);
router.get("/summary", authorize("fees.totals"), validate(v.validateSummary), c.summary);

const adj = require("../controllers/fee_adjustment");
const adjV = require("../validations/fee_adjustment");
router.post("/months/:id/adjustments", authorize("fees.months.adjust"), validate(adjV.validateRequest), adj.request);
router.post("/adjustments/:id/approve", authorize("fees.months.adjust"), validate(adjV.validateId), adj.approve);
router.post("/adjustments/:id/reject", authorize("fees.months.adjust"), validate(adjV.validateReject), adj.reject);

module.exports = router;
