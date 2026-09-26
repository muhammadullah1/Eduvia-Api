"use strict";

const { examService } = require("../services");
const { SHEET_STATUS } = require("../constants");

module.exports = {
  list: async (req, res, next) => {
    try {
      const data = await examService.list(req.user.schoolId, req.query);
      res.status(200).json({ success: true, message: "Mark sheets", data });
    } catch (err) {
      next(err);
    }
  },
  getById: async (req, res, next) => {
    try {
      const data = await examService.getById(req.params.id, req.user.schoolId);
      res.status(200).json({ success: true, message: "Mark sheet", data });
    } catch (err) {
      next(err);
    }
  },
  create: async (req, res, next) => {
    try {
      const data = await examService.create(req.user.schoolId, req.body);
      res.status(201).json({ success: true, message: "Mark sheet created", data });
    } catch (err) {
      next(err);
    }
  },
  updateRows: async (req, res, next) => {
    try {
      const data = await examService.updateRows(
        req.params.id,
        req.user.schoolId,
        req.body.rows,
      );
      res.status(200).json({ success: true, message: "Rows updated", data });
    } catch (err) {
      next(err);
    }
  },
  submit: async (req, res, next) => {
    try {
      const data = await examService.setStatus(req.params.id, req.user.schoolId, SHEET_STATUS.SUBMITTED);
      res.status(200).json({ success: true, message: "Submitted", data });
    } catch (err) {
      next(err);
    }
  },
  verify: async (req, res, next) => {
    try {
      const data = await examService.setStatus(req.params.id, req.user.schoolId, SHEET_STATUS.VERIFIED);
      res.status(200).json({ success: true, message: "Verified", data });
    } catch (err) {
      next(err);
    }
  },
  publish: async (req, res, next) => {
    try {
      const data = await examService.setStatus(req.params.id, req.user.schoolId, SHEET_STATUS.PUBLISHED);
      res.status(200).json({ success: true, message: "Published", data });
    } catch (err) {
      next(err);
    }
  },
};
