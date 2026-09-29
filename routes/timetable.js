"use strict";

const express = require("express");
const router = express.Router();
const { timetableController } = require("../controllers");
const { authorizeRoles } = require("../middlewares/authorize_roles");
const { USER_ROLES, MGMT_ROLES } = require("../constants");
const validate = require("../middlewares/validate");
const {
  validateList,
  validateCreate,
  validateUpdate,
  validateId,
} = require("../validations/timetable");

const all = [...MGMT_ROLES, USER_ROLES.TEACHER, USER_ROLES.PARENT];
const mgmt = MGMT_ROLES;

router.get("/", authorizeRoles(all), validate(validateList), timetableController.list);
router.post("/", authorizeRoles(mgmt), validate(validateCreate), timetableController.create);
router.patch("/:id", authorizeRoles(mgmt), validate(validateUpdate), timetableController.update);
router.delete("/:id", authorizeRoles(mgmt), validate(validateId), timetableController.remove);

module.exports = router;
