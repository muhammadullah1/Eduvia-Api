"use strict";

const express = require("express");
const router = express.Router();
const { teacherAbsenceController } = require("../controllers");
const { authorizeRoles } = require("../middlewares/authorize_roles");
const { USER_ROLES, MGMT_ROLES } = require("../constants");
const validate = require("../middlewares/validate");
const {
  validateCreate,
  validateUpdate,
  validateId,
} = require("../validations/teacher_absence");

const staff = [...MGMT_ROLES, USER_ROLES.TEACHER];

router.get("/", authorizeRoles(staff), teacherAbsenceController.list);
router.post("/", authorizeRoles(MGMT_ROLES), validate(validateCreate), teacherAbsenceController.create);
router.patch("/:id", authorizeRoles(MGMT_ROLES), validate(validateUpdate), teacherAbsenceController.update);
router.delete("/:id", authorizeRoles(MGMT_ROLES), validate(validateId), teacherAbsenceController.remove);

module.exports = router;
