"use strict";

const { blockDateService } = require("../services");

module.exports = {
  list: async (req, res, next) => {
    try {
      const archived = req.query.archived === "1" || req.query.archived === "true";
      const data = await blockDateService.list(req.user.schoolId, {
        search: req.query.search,
        archived,
      });
      res.status(200).json({ success: true, message: "Block dates", data });
    } catch (err) {
      next(err);
    }
  },
  create: async (req, res, next) => {
    try {
      const data = await blockDateService.create(req.user.schoolId, req.body);
      res.status(201).json({ success: true, message: "Block date created", data });
    } catch (err) {
      next(err);
    }
  },
  update: async (req, res, next) => {
    try {
      const data = await blockDateService.update(
        req.params.id,
        req.user.schoolId,
        req.body,
      );
      res.status(200).json({ success: true, message: "Block date updated", data });
    } catch (err) {
      next(err);
    }
  },
  remove: async (req, res, next) => {
    try {
      await blockDateService.remove(req.params.id, req.user.schoolId);
      res.status(200).json({ success: true, message: "Block date archived" });
    } catch (err) {
      next(err);
    }
  },
  restore: async (req, res, next) => {
    try {
      const data = await blockDateService.restore(req.params.id, req.user.schoolId);
      res.status(200).json({ success: true, message: "Block date restored", data });
    } catch (err) {
      next(err);
    }
  },
};
