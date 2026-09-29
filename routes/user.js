"use strict";

const express = require("express");
const router = express.Router();
const { userController } = require("../controllers");
const { authorizeRoles } = require("../middlewares/authorize_roles");
const { USER_ROLES, MGMT_ROLES } = require("../constants");
const validate = require("../middlewares/validate");
const { validateCreate } = require("../validations/user");

router.get("/", authorizeRoles(MGMT_ROLES), userController.list);
router.post(
  "/",
  authorizeRoles(MGMT_ROLES),
  validate(validateCreate),
  userController.create,
);

module.exports = router;
