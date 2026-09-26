"use strict";

const express = require("express");
const router = express.Router();
const { classController } = require("../controllers");
const { authorizeRoles } = require("../middlewares/authorize_roles");
const { USER_ROLES } = require("../constants");
const validate = require("../middlewares/validate");
const { validateCreate, validateUpdate, validateId } = require("../validations/class");

const all = [USER_ROLES.MANAGEMENT, USER_ROLES.TEACHER, USER_ROLES.PARENT];
const mgmt = [USER_ROLES.MANAGEMENT];

router.get("/", authorizeRoles(all), classController.list);
router.post("/", authorizeRoles(mgmt), validate(validateCreate), classController.create);
router.patch("/:id", authorizeRoles(mgmt), validate(validateId), validate(validateUpdate), classController.update);
router.delete("/:id", authorizeRoles(mgmt), validate(validateId), classController.remove);

module.exports = router;
