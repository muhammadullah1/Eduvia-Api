"use strict";

const express = require("express");
const router = express.Router();
const { feeController } = require("../controllers");
const { authorizeRoles } = require("../middlewares/authorize_roles");
const { USER_ROLES } = require("../constants");
const validate = require("../middlewares/validate");
const { validateCreate } = require("../validations/fee");

const all = [USER_ROLES.MANAGEMENT, USER_ROLES.PARENT];
const mgmt = [USER_ROLES.MANAGEMENT];

router.get("/", authorizeRoles(all), feeController.list);
router.post("/", authorizeRoles(mgmt), validate(validateCreate), feeController.create);

module.exports = router;
