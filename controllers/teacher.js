"use strict";

const { teacherService } = require("../services");

module.exports = {
  list: async (req, res, next) => {
    try {
      const data = await teacherService.list(req.user.schoolId);
      res.status(200).json({ success: true, message: "Teachers", data });
    } catch (err) {
      next(err);
    }
  },
  getById: async (req, res, next) => {
    try {
      const data = await teacherService.getById(req.params.id, req.user.schoolId);
      res.status(200).json({ success: true, message: "Teacher", data });
    } catch (err) {
      next(err);
    }
  },
  assignSubjects: async (req, res, next) => {
    try {
      const data = await teacherService.assignSubjects(
        req.params.id,
        req.user.schoolId,
        {
          subjectIds: req.body.subjectIds,
          primarySubjectId: req.body.primarySubjectId,
        },
      );
      res.status(200).json({ success: true, message: "Subjects assigned", data });
    } catch (err) {
      next(err);
    }
  },
  assignPrimarySubject: async (req, res, next) => {
    try {
      const data = await teacherService.assignPrimarySubject(
        req.params.id,
        req.user.schoolId,
        req.body.primarySubjectId,
      );
      res.status(200).json({ success: true, message: "Primary subject updated", data });
    } catch (err) {
      next(err);
    }
  },
  assignClasses: async (req, res, next) => {
    try {
      const data = await teacherService.assignClasses(
        req.params.id,
        req.user.schoolId,
        req.body.classIds,
      );
      res.status(200).json({ success: true, message: "Classes assigned", data });
    } catch (err) {
      next(err);
    }
  },
};
