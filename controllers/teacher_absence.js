"use strict";

const { teacherAbsenceService } = require("../services");

module.exports = {
  list: async (req, res, next) => {
    try {
      const data = await teacherAbsenceService.list(req.user.schoolId, req.query);
      res.status(200).json({ success: true, message: "Teacher absences", data });
    } catch (err) {
      next(err);
    }
  },
  create: async (req, res, next) => {
    try {
      const data = await teacherAbsenceService.create(req.user.schoolId, req.body);
      res.status(201).json({ success: true, message: "Absence recorded", data });
    } catch (err) {
      next(err);
    }
  },
  update: async (req, res, next) => {
    try {
      const data = await teacherAbsenceService.update(
        req.params.id,
        req.user.schoolId,
        req.body,
      );
      res.status(200).json({ success: true, message: "Absence updated", data });
    } catch (err) {
      next(err);
    }
  },
  remove: async (req, res, next) => {
    try {
      await teacherAbsenceService.remove(req.params.id, req.user.schoolId);
      res.status(200).json({ success: true, message: "Absence removed" });
    } catch (err) {
      next(err);
    }
  },
};
