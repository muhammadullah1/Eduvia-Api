"use strict";

const express = require("express");
const { authorize } = require("../middlewares/authorize");
const { authorizeRoles } = require("../middlewares/authorize_roles");
const { rolesFor, can } = require("../constants/permissions");
const validate = require("../middlewares/validate");
const { settingsController: c } = require("../controllers");
const { permissionFor } = require("../services/settings.service");
const v = require("../validations/settings");
const ApiError = require("../utils/ApiError");

const router = express.Router();

const writers = [...new Set([...rolesFor("settings.academic.update"), ...rolesFor("settings.fees.update")])];

function authorizeSettingWrite(req, res, next) {
  const permission = permissionFor(req.params.key);
  if (permission && !can(req.user.role, permission)) {
    return next(new ApiError(403, "You cannot change this setting."));
  }
  return next();
}

router.get("/", authorize("settings.read"), c.getAll);
router.put("/:key", authorizeRoles(writers), authorizeSettingWrite, validate(v.validateUpdate), c.update);

module.exports = router;
