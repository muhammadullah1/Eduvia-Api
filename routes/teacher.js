"use strict";

const express = require("express");
const router = express.Router();
const { teacherController } = require("../controllers");
const { authorizeRoles } = require("../middlewares/authorize_roles");
const { USER_ROLES, MGMT_ROLES } = require("../constants");
const validate = require("../middlewares/validate");
const {
  validateAssignSubjects,
  validateAssignPrimarySubject,
  validateAssignClasses,
  validateId,
} = require("../validations/teacher");

const staff = [...MGMT_ROLES, USER_ROLES.TEACHER];

router.get("/", authorizeRoles(staff), teacherController.list);
router.get("/:id", authorizeRoles(staff), validate(validateId), teacherController.getById);
router.post(
  "/:id/subjects",
  authorizeRoles(MGMT_ROLES),
  validate(validateAssignSubjects),
  teacherController.assignSubjects,
);
router.post(
  "/:id/primary-subject",
  authorizeRoles(MGMT_ROLES),
  validate(validateAssignPrimarySubject),
  teacherController.assignPrimarySubject,
);
router.post(
  "/:id/classes",
  authorizeRoles(MGMT_ROLES),
  validate(validateAssignClasses),
  teacherController.assignClasses,
);

module.exports = router;
