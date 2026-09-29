"use strict";

const express = require("express");
const router = express.Router();
const { schoolController } = require("../controllers");
const { authorizeRoles } = require("../middlewares/authorize_roles");
const { USER_ROLES, MGMT_ROLES, FEE_ROLES } = require("../constants");
const validate = require("../middlewares/validate");
const { validateUpdate } = require("../validations/school");

router.get(
  "/current",
  authorizeRoles([...MGMT_ROLES, USER_ROLES.TEACHER, USER_ROLES.PARENT, USER_ROLES.ACCOUNTANT]),
  schoolController.getCurrent,
);
router.patch(
  "/current",
  authorizeRoles(MGMT_ROLES),
  validate(validateUpdate),
  schoolController.update,
);

module.exports = router;
