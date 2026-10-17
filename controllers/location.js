"use strict";

const { locationService } = require("../services");

module.exports = {
  list: async (req, res, next) => {
    try {
      const archived = req.query.archived === "1" || req.query.archived === "true";
      const data = await locationService.list(req.user.schoolId, {
        search: req.query.search,
        archived,
        sessionId: req.query.sessionId ? Number(req.query.sessionId) : undefined,
      });
      res.status(200).json({ success: true, message: "Locations", data });
    } catch (err) {
      next(err);
    }
  },
  create: async (req, res, next) => {
    try {
      const data = await locationService.create(req.user.schoolId, req.body);
      res.status(201).json({ success: true, message: "Location created", data });
    } catch (err) {
      next(err);
    }
  },
  update: async (req, res, next) => {
    try {
      const data = await locationService.update(
        req.params.id,
        req.user.schoolId,
        req.body,
      );
      res.status(200).json({ success: true, message: "Location updated", data });
    } catch (err) {
      next(err);
    }
  },
  remove: async (req, res, next) => {
    try {
      await locationService.remove(req.params.id, req.user.schoolId);
      res.status(200).json({ success: true, message: "Location archived" });
    } catch (err) {
      next(err);
    }
  },
  restore: async (req, res, next) => {
    try {
      const data = await locationService.restore(req.params.id, req.user.schoolId);
      res.status(200).json({ success: true, message: "Location restored", data });
    } catch (err) {
      next(err);
    }
  },
};
