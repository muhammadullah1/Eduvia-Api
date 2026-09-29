"use strict";

const express = require("express");
const router = express.Router();
const { dailyTestController } = require("../controllers");
const { authorizeRoles } = require("../middlewares/authorize_roles");
const { USER_ROLES, MGMT_ROLES } = require("../constants");
const validate = require("../middlewares/validate");
const {
  validateCreate,
  validateResults,
  validateId,
} = require("../validations/daily_test");

const staff = [...MGMT_ROLES, USER_ROLES.TEACHER];
const all = [...staff, USER_ROLES.PARENT];

router.get("/", authorizeRoles(all), dailyTestController.list);
router.get("/:id", authorizeRoles(all), validate(validateId), dailyTestController.getById);
router.post("/", authorizeRoles(staff), validate(validateCreate), dailyTestController.create);
router.patch(
  "/:id/results",
  authorizeRoles(staff),
  validate(validateResults),
  dailyTestController.updateResults,
);

module.exports = router;
