"use strict";

const { subjectService } = require("../services");

module.exports = {
  list: async (req, res, next) => {
    try {
      const data = await subjectService.list(req.user.schoolId);
      res.status(200).json({ success: true, message: "Subjects", data });
    } catch (err) {
      next(err);
    }
  },
  create: async (req, res, next) => {
    try {
      const data = await subjectService.create(req.user.schoolId, req.body);
      res.status(201).json({ success: true, message: "Subject created", data });
    } catch (err) {
      next(err);
    }
  },
  update: async (req, res, next) => {
    try {
      const data = await subjectService.update(req.params.id, req.user.schoolId, req.body);
      res.status(200).json({ success: true, message: "Subject updated", data });
    } catch (err) {
      next(err);
    }
  },
  remove: async (req, res, next) => {
    try {
      await subjectService.remove(req.params.id, req.user.schoolId);
      res.status(200).json({ success: true, message: "Subject deleted" });
    } catch (err) {
      next(err);
    }
  },
};
