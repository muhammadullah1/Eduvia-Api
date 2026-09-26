"use strict";

const express = require("express");
const router = express.Router();
const { sessionController } = require("../controllers");
const { authorizeRoles } = require("../middlewares/authorize_roles");
const { USER_ROLES } = require("../constants");
const validate = require("../middlewares/validate");
const { validateCreate, validateUpdate, validateId } = require("../validations/session");

const all = [USER_ROLES.MANAGEMENT, USER_ROLES.TEACHER, USER_ROLES.PARENT];
const mgmt = [USER_ROLES.MANAGEMENT];

router.get("/", authorizeRoles(all), sessionController.list);
router.post("/", authorizeRoles(mgmt), validate(validateCreate), sessionController.create);
router.patch("/:id", authorizeRoles(mgmt), validate(validateId), validate(validateUpdate), sessionController.update);
router.post("/:id/activate", authorizeRoles(mgmt), validate(validateId), sessionController.activate);
router.delete("/:id", authorizeRoles(mgmt), validate(validateId), sessionController.remove);

module.exports = router;
