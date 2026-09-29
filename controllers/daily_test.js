"use strict";

const { dailyTestService } = require("../services");

module.exports = {
  list: async (req, res, next) => {
    try {
      const data = await dailyTestService.list(req.user.schoolId, req.query);
      res.status(200).json({ success: true, message: "Daily tests", data });
    } catch (err) {
      next(err);
    }
  },
  getById: async (req, res, next) => {
    try {
      const data = await dailyTestService.getById(req.params.id, req.user.schoolId);
      res.status(200).json({ success: true, message: "Daily test", data });
    } catch (err) {
      next(err);
    }
  },
  create: async (req, res, next) => {
    try {
      const data = await dailyTestService.create(req.user.schoolId, req.body);
      res.status(201).json({ success: true, message: "Daily test created", data });
    } catch (err) {
      next(err);
    }
  },
  updateResults: async (req, res, next) => {
    try {
      const data = await dailyTestService.updateResults(
        req.params.id,
        req.user.schoolId,
        req.body.results,
      );
      res.status(200).json({ success: true, message: "Daily test results updated", data });
    } catch (err) {
      next(err);
    }
  },
};
