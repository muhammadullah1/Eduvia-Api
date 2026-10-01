"use strict";

const { feeService } = require("../services");
const { handle } = require("../utils/handler");

module.exports = {
  generateMonths: handle("Fee months generated", (req) => feeService.generateMonths(req.user, req.body), 201),
  listMonths: handle("Fee months", (req) => feeService.listMonths(req.user, req.query.studentId)),
  listPayments: handle("Payments", (req) => feeService.listPayments(req.user, req.query)),
  recordPayment: async (req, res, next) => {
    try {
      const { duplicate, receipt } = await feeService.recordPayment(req.user, req.body);
      res.status(duplicate ? 200 : 201).json({
        success: true,
        message: duplicate ? "Payment already recorded" : "Payment recorded",
        data: { duplicate, receipt },
      });
    } catch (err) {
      next(err);
    }
  },
  confirmPayment: handle("Payment confirmed", (req) => feeService.confirmPayment(req.user, req.params.id)),
  receipt: handle("Receipt", (req) => feeService.receipt(req.user, req.params.id)),
  myCollections: handle("My collections", (req) => feeService.myCollections(req.user, req.query)),
  collections: handle("Collections", (req) => feeService.collections(req.user, req.query)),
  summary: handle("Fee summary", (req) => feeService.summary(req.user, req.query)),
};
