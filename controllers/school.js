"use strict";

const { schoolService } = require("../services");

module.exports = {
  getCurrent: async (req, res, next) => {
    try {
      const school = await schoolService.getCurrent(req.user.schoolId);
      res.status(200).json({ success: true, message: "School", data: school });
    } catch (err) {
      next(err);
    }
  },
  update: async (req, res, next) => {
    try {
      const school = await schoolService.update(req.user.schoolId, req.body);
      res.status(200).json({ success: true, message: "School updated", data: school });
    } catch (err) {
      next(err);
    }
  },
};
