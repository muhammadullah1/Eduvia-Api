"use strict";

const express = require("express");
const router = express.Router();
const { schoolController } = require("../controllers");
const { authorizeRoles } = require("../middlewares/authorize_roles");
const { USER_ROLES } = require("../constants");
const validate = require("../middlewares/validate");
const { validateUpdate } = require("../validations/school");

router.get(
  "/current",
  authorizeRoles([USER_ROLES.MANAGEMENT, USER_ROLES.TEACHER, USER_ROLES.PARENT]),
  schoolController.getCurrent,
);
router.patch(
  "/current",
  authorizeRoles([USER_ROLES.MANAGEMENT]),
  validate(validateUpdate),
  schoolController.update,
);

module.exports = router;
