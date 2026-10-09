"use strict";

const { studentService, accessService } = require("../services");
const { USER_ROLES } = require("../constants");
const { buildPagination } = require("../utils");

module.exports = {
  list: async (req, res, next) => {
    try {
      const scope = {};
      if (req.user.role === USER_ROLES.PARENT) scope.studentIds = await accessService.linkedStudentIds(req.user);
      if (req.user.role === USER_ROLES.TEACHER) {
        scope.classIds = await accessService.teacherClassIds(await accessService.teacherFor(req.user));
      }
      const result = await studentService.list(req.user.schoolId, req.query, scope);
      res.status(200).json({
        success: true,
        message: "Students",
        data: buildPagination(result.rows, result.count, result.page, result.pageSize, "students"),
      });
    } catch (err) {
      next(err);
    }
  },
  getById: async (req, res, next) => {
    try {
      await accessService.assertStudentAccess(req.user, req.params.id);
      const data = await studentService.getById(req.params.id, req.user.schoolId);
      res.status(200).json({ success: true, message: "Student", data });
    } catch (err) {
      next(err);
    }
  },
  create: async (req, res, next) => {
    try {
      const data = await studentService.create(req.user.schoolId, req.body);
      res.status(201).json({ success: true, message: "Student created", data });
    } catch (err) {
      next(err);
    }
  },
  update: async (req, res, next) => {
    try {
      const data = await studentService.update(req.params.id, req.user.schoolId, req.body);
      res.status(200).json({ success: true, message: "Student updated", data });
    } catch (err) {
      next(err);
    }
  },
  remove: async (req, res, next) => {
    try {
      await studentService.remove(req.params.id, req.user.schoolId);
      res.status(200).json({ success: true, message: "Student deleted" });
    } catch (err) {
      next(err);
    }
  },
};
