"use strict";

const express = require("express");
const router = express.Router();
const { applicationController } = require("../controllers");
const { authorizeRoles } = require("../middlewares/authorize_roles");
const { USER_ROLES, MGMT_ROLES } = require("../constants");
const validate = require("../middlewares/validate");
const {
  validateCreate,
  validateUpdate,
  validateDecide,
  validateEnroll,
  validateId,
} = require("../validations/application");

const mgmt = MGMT_ROLES;

router.get("/", authorizeRoles(mgmt), applicationController.list);
router.get("/:id", authorizeRoles(mgmt), validate(validateId), applicationController.getById);
router.post("/", authorizeRoles(mgmt), validate(validateCreate), applicationController.create);
router.patch("/:id", authorizeRoles(mgmt), validate(validateId), validate(validateUpdate), applicationController.update);
router.post("/:id/decide", authorizeRoles(mgmt), validate(validateDecide), applicationController.decide);
router.post("/:id/enroll", authorizeRoles(mgmt), validate(validateEnroll), applicationController.enroll);

module.exports = router;
