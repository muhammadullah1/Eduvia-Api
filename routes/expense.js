"use strict";

const express = require("express");
const { authorize } = require("../middlewares/authorize");
const validate = require("../middlewares/validate");
const { expenseController: c } = require("../controllers");
const v = require("../validations/expense");

const router = express.Router();

router.get("/", authorize("expenses.read"), validate(v.validateList), c.list);
router.get("/:id", authorize("expenses.read"), validate(v.validateId), c.getById);
router.post("/", authorize("expenses.create"), validate(v.validateCreate), c.create);
router.patch("/:id", authorize("expenses.manage"), validate(v.validateUpdate), c.update);
router.delete("/:id", authorize("expenses.manage"), validate(v.validateId), c.remove);

module.exports = router;
