"use strict";

const { timetableService } = require("../services");

module.exports = {
  list: async (req, res, next) => {
    try {
      const data = await timetableService.listByClass(req.user.schoolId, req.query.classId);
      res.status(200).json({ success: true, message: "Timetable", data });
    } catch (err) {
      next(err);
    }
  },
  create: async (req, res, next) => {
    try {
      const data = await timetableService.create(req.user.schoolId, req.body);
      res.status(201).json({ success: true, message: "Slot created", data });
    } catch (err) {
      next(err);
    }
  },
  update: async (req, res, next) => {
    try {
      const data = await timetableService.update(req.params.id, req.user.schoolId, req.body);
      res.status(200).json({ success: true, message: "Slot updated", data });
    } catch (err) {
      next(err);
    }
  },
  remove: async (req, res, next) => {
    try {
      await timetableService.remove(req.params.id, req.user.schoolId);
      res.status(200).json({ success: true, message: "Slot deleted" });
    } catch (err) {
      next(err);
    }
  },
};
