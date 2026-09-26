"use strict";

const { sessionService } = require("../services");

module.exports = {
  list: async (req, res, next) => {
    try {
      const data = await sessionService.list(req.user.schoolId);
      res.status(200).json({ success: true, message: "Sessions", data });
    } catch (err) {
      next(err);
    }
  },
  create: async (req, res, next) => {
    try {
      const data = await sessionService.create(req.user.schoolId, req.body);
      res.status(201).json({ success: true, message: "Session created", data });
    } catch (err) {
      next(err);
    }
  },
  update: async (req, res, next) => {
    try {
      const data = await sessionService.update(req.params.id, req.user.schoolId, req.body);
      res.status(200).json({ success: true, message: "Session updated", data });
    } catch (err) {
      next(err);
    }
  },
  activate: async (req, res, next) => {
    try {
      const data = await sessionService.activate(req.params.id, req.user.schoolId);
      res.status(200).json({ success: true, message: "Session activated", data });
    } catch (err) {
      next(err);
    }
  },
  remove: async (req, res, next) => {
    try {
      await sessionService.remove(req.params.id, req.user.schoolId);
      res.status(200).json({ success: true, message: "Session deleted" });
    } catch (err) {
      next(err);
    }
  },
};
