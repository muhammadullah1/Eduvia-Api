"use strict";

const express = require("express");
const router = express.Router();
const { parentController } = require("../controllers");
const { authorizeRoles } = require("../middlewares/authorize_roles");
const { USER_ROLES, MGMT_ROLES } = require("../constants");
const validate = require("../middlewares/validate");
const { validateCreate, validateLink } = require("../validations/parent");

const mgmt = MGMT_ROLES;

router.get("/", authorizeRoles(mgmt), parentController.list);
router.post("/", authorizeRoles(mgmt), validate(validateCreate), parentController.create);
router.post("/:id/link-student", authorizeRoles(mgmt), validate(validateLink), parentController.linkStudent);

module.exports = router;
