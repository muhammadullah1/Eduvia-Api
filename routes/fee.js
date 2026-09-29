"use strict";

const express = require("express");
const router = express.Router();
const { feeController } = require("../controllers");
const { authorizeRoles } = require("../middlewares/authorize_roles");
const { USER_ROLES, FEE_ROLES } = require("../constants");
const validate = require("../middlewares/validate");
const { validateCreate, validateStatus } = require("../validations/fee");

const viewers = [...FEE_ROLES, USER_ROLES.PARENT];

router.get("/", authorizeRoles(viewers), feeController.list);
router.post("/", authorizeRoles(FEE_ROLES), validate(validateCreate), feeController.create);
router.patch(
  "/:id/status",
  authorizeRoles(FEE_ROLES),
  validate(validateStatus),
  feeController.updateStatus,
);

module.exports = router;
