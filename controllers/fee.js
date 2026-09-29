"use strict";

const { feeService } = require("../services");

module.exports = {
  list: async (req, res, next) => {
    try {
      const data = await feeService.list(req.user.schoolId, req.query);
      res.status(200).json({ success: true, message: "Payments", data });
    } catch (err) {
      next(err);
    }
  },
  create: async (req, res, next) => {
    try {
      const data = await feeService.create(req.user.schoolId, req.body);
      res.status(201).json({ success: true, message: "Payment created", data });
    } catch (err) {
      next(err);
    }
  },
  updateStatus: async (req, res, next) => {
    try {
      const data = await feeService.updateStatus(
        req.params.id,
        req.user.schoolId,
        req.body.status,
      );
      res.status(200).json({ success: true, message: "Payment status updated", data });
    } catch (err) {
      next(err);
    }
  },
};
