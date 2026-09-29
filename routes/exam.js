"use strict";

const express = require("express");
const router = express.Router();
const { examController } = require("../controllers");
const { authorizeRoles } = require("../middlewares/authorize_roles");
const { USER_ROLES, MGMT_ROLES } = require("../constants");
const validate = require("../middlewares/validate");
const {
  validateCreate,
  validateRows,
  validateId,
  validateOverride,
} = require("../validations/exam");

const staff = [...MGMT_ROLES, USER_ROLES.TEACHER];
const all = [...staff, USER_ROLES.PARENT];

router.get("/", authorizeRoles(all), examController.list);
router.get("/:id", authorizeRoles(all), validate(validateId), examController.getById);
router.post("/", authorizeRoles(staff), validate(validateCreate), examController.create);
router.patch("/:id/rows", authorizeRoles(staff), validate(validateRows), examController.updateRows);
router.post("/:id/submit", authorizeRoles(staff), validate(validateId), examController.submit);
router.post("/:id/verify", authorizeRoles(MGMT_ROLES), validate(validateId), examController.verify);
router.post("/:id/publish", authorizeRoles(MGMT_ROLES), validate(validateId), examController.publish);
router.post(
  "/:id/override-fee",
  authorizeRoles(MGMT_ROLES),
  validate(validateOverride),
  examController.overrideFeeGate,
);

module.exports = router;
