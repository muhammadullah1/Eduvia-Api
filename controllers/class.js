"use strict";

const { classService } = require("../services");

module.exports = {
  list: async (req, res, next) => {
    try {
      const data = await classService.list(req.user.schoolId, { sessionId: req.query.sessionId });
      res.status(200).json({ success: true, message: "Classes", data });
    } catch (err) {
      next(err);
    }
  },
  create: async (req, res, next) => {
    try {
      const data = await classService.create(req.user.schoolId, req.body);
      res.status(201).json({ success: true, message: "Class created", data });
    } catch (err) {
      next(err);
    }
  },
  update: async (req, res, next) => {
    try {
      const data = await classService.update(req.params.id, req.user.schoolId, req.body);
      res.status(200).json({ success: true, message: "Class updated", data });
    } catch (err) {
      next(err);
    }
  },
  remove: async (req, res, next) => {
    try {
      await classService.remove(req.params.id, req.user.schoolId);
      res.status(200).json({ success: true, message: "Class deleted" });
    } catch (err) {
      next(err);
    }
  },
};
