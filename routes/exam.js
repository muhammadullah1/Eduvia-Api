"use strict";

const express = require("express");
const router = express.Router();
const { examController } = require("../controllers");
const { authorizeRoles } = require("../middlewares/authorize_roles");
const { USER_ROLES } = require("../constants");
const validate = require("../middlewares/validate");
const { validateCreate, validateRows, validateId } = require("../validations/exam");

const staff = [USER_ROLES.MANAGEMENT, USER_ROLES.TEACHER];
const all = [USER_ROLES.MANAGEMENT, USER_ROLES.TEACHER, USER_ROLES.PARENT];
const mgmt = [USER_ROLES.MANAGEMENT];

router.get("/", authorizeRoles(all), examController.list);
router.get("/:id", authorizeRoles(all), validate(validateId), examController.getById);
router.post("/", authorizeRoles(staff), validate(validateCreate), examController.create);
router.patch("/:id/rows", authorizeRoles(staff), validate(validateRows), examController.updateRows);
router.post("/:id/submit", authorizeRoles(staff), validate(validateId), examController.submit);
router.post("/:id/verify", authorizeRoles(mgmt), validate(validateId), examController.verify);
router.post("/:id/publish", authorizeRoles(mgmt), validate(validateId), examController.publish);

module.exports = router;
