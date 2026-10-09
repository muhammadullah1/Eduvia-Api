"use strict";

const express = require("express");
const { authorize } = require("../middlewares/authorize");
const validate = require("../middlewares/validate");
const { studentController: c } = require("../controllers");
const v = require("../validations/student");

const router = express.Router();
const manage = authorize("students.manage");

router.get("/", authorize("students.read"), c.list);
router.get("/:id", authorize("students.read"), validate(v.validateId), c.getById);
router.post("/", manage, validate(v.validateCreate), c.create);
router.patch("/:id", manage, validate(v.validateId), validate(v.validateUpdate), c.update);
router.post("/:id/status", manage, validate(v.validateStatus), c.changeStatus);
router.post("/:id/promote", manage, validate(v.validatePromote), c.promote);
router.delete("/:id", manage, validate(v.validateId), c.remove);

module.exports = router;
