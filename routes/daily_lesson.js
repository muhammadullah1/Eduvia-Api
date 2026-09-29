"use strict";

const express = require("express");
const router = express.Router();
const { dailyLessonController } = require("../controllers");
const { authorizeRoles } = require("../middlewares/authorize_roles");
const { USER_ROLES, MGMT_ROLES } = require("../constants");
const validate = require("../middlewares/validate");
const {
  validateCreate,
  validateUpdate,
  validateId,
} = require("../validations/daily_lesson");

const staff = [...MGMT_ROLES, USER_ROLES.TEACHER];

router.get("/", authorizeRoles(staff), dailyLessonController.list);
router.post("/", authorizeRoles(staff), validate(validateCreate), dailyLessonController.create);
router.patch("/:id", authorizeRoles(staff), validate(validateUpdate), dailyLessonController.update);
router.delete("/:id", authorizeRoles(MGMT_ROLES), validate(validateId), dailyLessonController.remove);

module.exports = router;
