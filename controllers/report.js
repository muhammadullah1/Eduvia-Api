"use strict";

const schoolReportService = require("../services/school_report.service");
const { render, sendFile } = require("../utils/report_export");
const { schoolBranding } = require("../utils/branding");

module.exports = {
  studentReport: async (req, res, next) => {
    try {
      const { format, from, to, classId, status } = req.query;
      const report = await schoolReportService.build(req.user, req.params.kind, { from, to, classId, status });
      if (format === "json") return res.status(200).json({ success: true, message: report.title, data: report });
      const brand = await schoolBranding(req.user.schoolId, req.user.id);
      return sendFile(res, await render(report, format, brand), format, report.filename);
    } catch (err) {
      return next(err);
    }
  },
};
