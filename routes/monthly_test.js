"use strict";

const express = require("express");
const router = express.Router();
const { monthlyTestController } = require("../controllers");
const { authorizeRoles } = require("../middlewares/authorize_roles");
const { USER_ROLES, MGMT_ROLES } = require("../constants");
const validate = require("../middlewares/validate");
const {
  validateCreate,
  validateResults,
  validateId,
} = require("../validations/monthly_test");

const staff = [...MGMT_ROLES, USER_ROLES.TEACHER];
const all = [...staff, USER_ROLES.PARENT];

router.get("/summaries", authorizeRoles(all), monthlyTestController.listSummaries);
router.get("/", authorizeRoles(all), monthlyTestController.list);
router.get("/:id", authorizeRoles(all), validate(validateId), monthlyTestController.getById);
router.post("/", authorizeRoles(staff), validate(validateCreate), monthlyTestController.create);
router.patch(
  "/:id/results",
  authorizeRoles(staff),
  validate(validateResults),
  monthlyTestController.updateResults,
);

module.exports = router;
