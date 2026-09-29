"use strict";

const { monthlyTestService } = require("../services");

module.exports = {
  list: async (req, res, next) => {
    try {
      const data = await monthlyTestService.list(req.user.schoolId, req.query);
      res.status(200).json({ success: true, message: "Monthly tests", data });
    } catch (err) {
      next(err);
    }
  },
  getById: async (req, res, next) => {
    try {
      const data = await monthlyTestService.getById(req.params.id, req.user.schoolId);
      res.status(200).json({ success: true, message: "Monthly test", data });
    } catch (err) {
      next(err);
    }
  },
  create: async (req, res, next) => {
    try {
      const data = await monthlyTestService.create(req.user.schoolId, req.body);
      res.status(201).json({ success: true, message: "Monthly test created", data });
    } catch (err) {
      next(err);
    }
  },
  updateResults: async (req, res, next) => {
    try {
      const data = await monthlyTestService.updateResults(
        req.params.id,
        req.user.schoolId,
        req.body.results,
      );
      res.status(200).json({ success: true, message: "Monthly test results updated", data });
    } catch (err) {
      next(err);
    }
  },
  listSummaries: async (req, res, next) => {
    try {
      const data = await monthlyTestService.listSummaries(req.user.schoolId, req.query);
      res.status(200).json({ success: true, message: "Monthly summaries", data });
    } catch (err) {
      next(err);
    }
  },
};
