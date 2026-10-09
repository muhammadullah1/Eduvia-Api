"use strict";

const express = require("express");
const { authorize } = require("../middlewares/authorize");
const validate = require("../middlewares/validate");
const { teacherAbsenceController: c } = require("../controllers");
const v = require("../validations/teacher_absence");

const router = express.Router();
const manage = authorize("absences.manage");

router.get("/", authorize("absences.read"), validate(v.validateList), c.list);
router.post("/", manage, validate(v.validateMarkAbsent), c.markAbsent);
router.get("/:id/available-substitutes", manage, validate(v.validateId), c.availableSubstitutes);
router.put("/:id/substitute", manage, validate(v.validateAssign), c.assignSubstitute);
router.delete("/:id/substitute", manage, validate(v.validateId), c.removeSubstitute);
router.post("/:id/cancel", manage, validate(v.validateId), c.cancel);

module.exports = router;
