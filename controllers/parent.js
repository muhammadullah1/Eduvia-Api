"use strict";

const { parentService } = require("../services");

module.exports = {
  list: async (req, res, next) => {
    try {
      const data = await parentService.list(req.user.schoolId);
      res.status(200).json({ success: true, message: "Parents", data });
    } catch (err) {
      next(err);
    }
  },
  create: async (req, res, next) => {
    try {
      const data = await parentService.createWithUser(req.user.schoolId, req.body);
      res.status(201).json({ success: true, message: "Parent created", data });
    } catch (err) {
      next(err);
    }
  },
  linkStudent: async (req, res, next) => {
    try {
      const data = await parentService.linkStudent(
        req.params.id,
        req.user.schoolId,
        req.body.studentId,
        req.body.isPrimary,
      );
      res.status(200).json({ success: true, message: "Student linked", data });
    } catch (err) {
      next(err);
    }
  },
};
