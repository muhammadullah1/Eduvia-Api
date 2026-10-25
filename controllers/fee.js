"use strict";

const { feeService, documentService } = require("../services");
const feeReportService = require("../services/fee_report.service");
const { importTemplate } = require("../services/fee_template.service");
const feeImportService = require("../services/fee_import.service");
const { render, sendFile } = require("../utils/report_export");
const { schoolBranding } = require("../utils/branding");
const { handle } = require("../utils/handler");

module.exports = {
  generateMonths: handle("Fee months generated", (req) => feeService.generateMonths(req.user, req.body), 201),
  previewGeneration: handle("Fee generation preview", (req) => feeService.previewGeneration(req.user, req.body)),
  studentLedger: handle("Student ledger", (req) => feeService.studentLedger(req.user, req.params.studentId)),
  listMonths: handle("Fee months", (req) => feeService.listMonths(req.user, req.query.studentId)),
  previewPayment: handle("Payment preview", (req) => feeService.previewPayment(req.user, req.body)),
  collectOverview: handle("Collect overview", (req) => feeService.collectOverview(req.user)),
  searchStudents: handle("Students", (req) => feeService.searchStudents(req.user, req.query)),
  collectContext: handle("Collect context", (req) => feeService.collectContext(req.user, req.params.studentId)),
  listPayments: handle("Payments", (req) => feeService.listPayments(req.user, req.query)),
  recordPayment: async (req, res, next) => {
    try {
      const { duplicate, receipt } = await feeService.recordPayment(req.user, req.body);
      res.status(duplicate ? 200 : 201).json({
        success: true,
        message: duplicate ? "Payment already recorded" : "Payment recorded",
        data: { duplicate, receipt },
      });
    } catch (err) {
      next(err);
    }
  },
  confirmPayment: handle("Payment confirmed", (req) => feeService.confirmPayment(req.user, req.params.id)),
  validateImport: handle("Fee import validated", (req) => feeImportService.validateFile(req.user, req.body), 201),
  commitImport: handle("Fee import committed", (req) => feeImportService.commit(req.user, req.params.id, req.get("Idempotency-Key"))),
  discardImport: handle("Fee import discarded", (req) => feeImportService.discard(req.user, req.params.id)),
  importDetail: handle("Fee import", (req) => feeImportService.detail(req.user, req.params.id)),
  importHistory: handle("Fee import history", (req) => feeImportService.history(req.user, req.query)),
  importErrorReport: async (req, res, next) => {
    try {
      const brand = await schoolBranding(req.user.schoolId, req.user.id);
      const { buffer, filename } = await feeImportService.errorReport(req.user, req.params.id, brand);
      return sendFile(res, buffer, "xlsx", filename);
    } catch (err) {
      return next(err);
    }
  },
  receipt: async (req, res, next) => {
    try {
      if (req.query.format === "pdf") {
        const buffer = await documentService.receiptPdf(req.user, req.params.id);
        res.set("Content-Type", "application/pdf");
        res.set("Content-Disposition", `inline; filename="receipt-${req.params.id}.pdf"`);
        return res.send(buffer);
      }
      const data = await feeService.receipt(req.user, req.params.id);
      return res.status(200).json({ success: true, message: "Receipt", data });
    } catch (err) {
      return next(err);
    }
  },
  myCollections: handle("My collections", (req) => feeService.myCollections(req.user, req.query)),
  collections: handle("Collections", (req) => feeService.collections(req.user, req.query)),
  report: async (req, res, next) => {
    try {
      const { format, from, to, month, classId } = req.query;
      const report = await feeReportService.build(req.user, req.params.kind, { from, to, month, classId });
      if (format === "json") return res.status(200).json({ success: true, message: report.title, data: report });
      const brand = await schoolBranding(req.user.schoolId, req.user.id);
      return sendFile(res, await render(report, format, brand), format, report.filename);
    } catch (err) {
      return next(err);
    }
  },
  importTemplate: async (req, res, next) => {
    try {
      const brand = await schoolBranding(req.user.schoolId, req.user.id);
      return sendFile(res, await importTemplate(brand), "xlsx", "fee-import-template");
    } catch (err) {
      return next(err);
    }
  },
  summary: handle("Fee summary", (req) => feeService.summary(req.user, req.query)),
};
