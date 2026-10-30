"use strict";

const { classService } = require("../services");
const { hasPermission } = require("../services/permission.service");

/** The class fee is set only by roles that manage fee settings; Ops edits the rest of the class. */
function withoutFeeUnlessAllowed(req) {
  if (hasPermission(req.user, "settings.fees.update")) return req.body;
  const body = { ...req.body };
  delete body.monthlyFee;
  delete body.monthlyTuitionFee;
  return body;
}

module.exports = {
  list: async (req, res, next) => {
    try {
      const includeStats =
        req.query.stats === "true" || req.query.stats === "1";
      const archived =
        req.query.archived === "true" || req.query.archived === "1";
      const data = await classService.list(req.user.schoolId, {
        sessionId: req.query.sessionId,
        includeStats,
        archived,
      });
      res.status(200).json({ success: true, message: "Classes", data });
    } catch (err) {
      next(err);
    }
  },
  create: async (req, res, next) => {
    try {
      const data = await classService.create(req.user.schoolId, withoutFeeUnlessAllowed(req));
      res.status(201).json({ success: true, message: "Class created", data });
    } catch (err) {
      next(err);
    }
  },
  update: async (req, res, next) => {
    try {
      const data = await classService.update(req.params.id, req.user.schoolId, withoutFeeUnlessAllowed(req));
      res.status(200).json({ success: true, message: "Class updated", data });
    } catch (err) {
      next(err);
    }
  },
  remove: async (req, res, next) => {
    try {
      await classService.remove(req.params.id, req.user.schoolId);
      res.status(200).json({ success: true, message: "Class archived" });
    } catch (err) {
      next(err);
    }
  },
  restore: async (req, res, next) => {
    try {
      const data = await classService.restore(req.params.id, req.user.schoolId);
      res.status(200).json({ success: true, message: "Class restored", data });
    } catch (err) {
      next(err);
    }
  },
};
