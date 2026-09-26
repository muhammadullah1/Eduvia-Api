"use strict";

const { applicationService } = require("../services");

module.exports = {
  list: async (req, res, next) => {
    try {
      const data = await applicationService.list(req.user.schoolId, req.query);
      res.status(200).json({ success: true, message: "Applications", data });
    } catch (err) {
      next(err);
    }
  },
  getById: async (req, res, next) => {
    try {
      const data = await applicationService.getById(req.params.id, req.user.schoolId);
      res.status(200).json({ success: true, message: "Application", data });
    } catch (err) {
      next(err);
    }
  },
  create: async (req, res, next) => {
    try {
      const data = await applicationService.create(req.user.schoolId, req.body);
      res.status(201).json({ success: true, message: "Application created", data });
    } catch (err) {
      next(err);
    }
  },
  update: async (req, res, next) => {
    try {
      const data = await applicationService.update(req.params.id, req.user.schoolId, req.body);
      res.status(200).json({ success: true, message: "Application updated", data });
    } catch (err) {
      next(err);
    }
  },
  decide: async (req, res, next) => {
    try {
      const data = await applicationService.decide(
        req.params.id,
        req.user.schoolId,
        req.body.decision,
      );
      res.status(200).json({ success: true, message: "Decision recorded", data });
    } catch (err) {
      next(err);
    }
  },
  enroll: async (req, res, next) => {
    try {
      const data = await applicationService.enroll(req.params.id, req.user.schoolId, req.body);
      res.status(200).json({ success: true, message: "Student enrolled", data });
    } catch (err) {
      next(err);
    }
  },
};
