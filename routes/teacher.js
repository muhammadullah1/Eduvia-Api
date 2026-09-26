"use strict";

const express = require("express");
const router = express.Router();
const { teacherController } = require("../controllers");
const { authorizeRoles } = require("../middlewares/authorize_roles");
const { USER_ROLES } = require("../constants");
const validate = require("../middlewares/validate");
const {
  validateAssignSubjects,
  validateAssignClasses,
  validateId,
} = require("../validations/teacher");

const staff = [USER_ROLES.MANAGEMENT, USER_ROLES.TEACHER];
const mgmt = [USER_ROLES.MANAGEMENT];

router.get("/", authorizeRoles(staff), teacherController.list);
router.get("/:id", authorizeRoles(staff), validate(validateId), teacherController.getById);
router.post(
  "/:id/subjects",
  authorizeRoles(mgmt),
  validate(validateAssignSubjects),
  teacherController.assignSubjects,
);
router.post(
  "/:id/classes",
  authorizeRoles(mgmt),
  validate(validateAssignClasses),
  teacherController.assignClasses,
);

module.exports = router;
