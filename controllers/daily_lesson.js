"use strict";

const { dailyLessonService } = require("../services");

module.exports = {
  list: async (req, res, next) => {
    try {
      const data = await dailyLessonService.list(req.user.schoolId, req.query);
      res.status(200).json({ success: true, message: "Daily lessons", data });
    } catch (err) {
      next(err);
    }
  },
  create: async (req, res, next) => {
    try {
      const data = await dailyLessonService.create(req.user.schoolId, req.body);
      res.status(201).json({ success: true, message: "Daily lesson created", data });
    } catch (err) {
      next(err);
    }
  },
  update: async (req, res, next) => {
    try {
      const data = await dailyLessonService.update(
        req.params.id,
        req.user.schoolId,
        req.body,
      );
      res.status(200).json({ success: true, message: "Daily lesson updated", data });
    } catch (err) {
      next(err);
    }
  },
  remove: async (req, res, next) => {
    try {
      await dailyLessonService.remove(req.params.id, req.user.schoolId);
      res.status(200).json({ success: true, message: "Daily lesson removed" });
    } catch (err) {
      next(err);
    }
  },
};
