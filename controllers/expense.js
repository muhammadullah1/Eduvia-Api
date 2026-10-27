"use strict";

const { expenseService } = require("../services");
const { handle } = require("../utils/handler");

module.exports = {
  list: handle("Expenses", (req) => expenseService.list(req.user, req.query)),
  getById: handle("Expense", (req) => expenseService.getById(req.user, req.params.id)),
  create: handle("Expense recorded", (req) => expenseService.create(req.user, req.body), 201),
  update: handle("Expense updated", (req) => expenseService.update(req.user, req.params.id, req.body)),
  remove: handle("Expense deleted", (req) => expenseService.remove(req.user, req.params.id, req.body)),
};
