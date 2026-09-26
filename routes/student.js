"use strict";

const express = require("express");
const router = express.Router();
const { studentController } = require("../controllers");
const { authorizeRoles } = require("../middlewares/authorize_roles");
const { USER_ROLES } = require("../constants");
const validate = require("../middlewares/validate");
const { validateCreate, validateUpdate, validateId } = require("../validations/student");

const all = [USER_ROLES.MANAGEMENT, USER_ROLES.TEACHER, USER_ROLES.PARENT];
const staff = [USER_ROLES.MANAGEMENT, USER_ROLES.TEACHER];
const mgmt = [USER_ROLES.MANAGEMENT];

router.get("/", authorizeRoles(all), studentController.list);
router.get("/:id", authorizeRoles(all), validate(validateId), studentController.getById);
router.post("/", authorizeRoles(mgmt), validate(validateCreate), studentController.create);
router.patch("/:id", authorizeRoles(staff), validate(validateId), validate(validateUpdate), studentController.update);
router.delete("/:id", authorizeRoles(mgmt), validate(validateId), studentController.remove);

module.exports = router;
