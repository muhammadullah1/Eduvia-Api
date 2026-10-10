"use strict";

const { applicationService } = require("../services");

module.exports = {
  list: async (req, res, next) => {
    try {
      const result = await applicationService.list(req.user.schoolId, req.query);
      res.status(200).json({
        success: true,
        message: "Applications",
        data: result.rows,
        meta: {
          count: result.count,
          page: result.page,
          pageSize: result.pageSize,
        },
      });
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
  createDraft: async (req, res, next) => {
    try {
      const data = await applicationService.createDraft(req.user.schoolId, req.body);
      res.status(201).json({ success: true, message: "Draft application created", data });
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
      const data = await applicationService.update(
        req.params.id,
        req.user.schoolId,
        req.body,
      );
      res.status(200).json({ success: true, message: "Application updated", data });
    } catch (err) {
      next(err);
    }
  },
  submit: async (req, res, next) => {
    try {
      const data = await applicationService.submit(req.params.id, req.user.schoolId);
      res.status(200).json({ success: true, message: "Application submitted", data });
    } catch (err) {
      next(err);
    }
  },
  review: async (req, res, next) => {
    try {
      const data = await applicationService.markUnderReview(
        req.params.id,
        req.user.schoolId,
      );
      res.status(200).json({ success: true, message: "Application under review", data });
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
        req.body.remarks,
      );
      res.status(200).json({ success: true, message: "Decision recorded", data });
    } catch (err) {
      next(err);
    }
  },
  enroll: async (req, res, next) => {
    try {
      const data = await applicationService.enroll(
        req.params.id,
        req.user.schoolId,
        req.body,
        req.user,
      );
      res.status(200).json({ success: true, message: "Student enrolled", data });
    } catch (err) {
      next(err);
    }
  },
};
