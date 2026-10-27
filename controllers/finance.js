"use strict";

const { financeService, auditService } = require("../services");
const { handle } = require("../utils/handler");
const { schoolBranding } = require("../utils/branding");
const { sendFile } = require("../utils/report_export");
const { renderFinance } = require("../utils/finance_export");

module.exports = {
  income: handle("Income", (req) => financeService.incomeList(req.user, req.query)),
  createIncome: handle("Income recorded", (req) => financeService.createIncome(req.user, req.body), 201),
  updateIncome: handle("Income updated", (req) => financeService.updateIncome(req.user, req.params.id, req.body)),
  removeIncome: handle("Income deleted", (req) => financeService.removeIncome(req.user, req.params.id, req.body)),
  report: handle("Financial report", (req) => financeService.report(req.user, req.query)),
  exportReport: async (req, res, next) => {
    try {
      const { format } = req.query;
      const report = await financeService.report(req.user, req.query, { withEntries: true });
      const brand = await schoolBranding(req.user.schoolId, req.user.id);
      const buffer = await renderFinance(report, format, brand);
      await auditService.record(req.user, `exported financial report ${report.period.key} (${format})`, { entityType: "finance_report", metadata: { period: report.period.key, format, net: report.totals.net } });
      return sendFile(res, buffer, format, `financial-report-${report.period.key}`);
    } catch (err) {
      return next(err);
    }
  },
};
