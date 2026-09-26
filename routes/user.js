"use strict";

const express = require("express");
const router = express.Router();
const { userController } = require("../controllers");
const { authorizeRoles } = require("../middlewares/authorize_roles");
const { USER_ROLES } = require("../constants");
const validate = require("../middlewares/validate");
const { validateCreate } = require("../validations/user");

router.get("/", authorizeRoles([USER_ROLES.MANAGEMENT]), userController.list);
router.post(
  "/",
  authorizeRoles([USER_ROLES.MANAGEMENT]),
  validate(validateCreate),
  userController.create,
);

module.exports = router;
