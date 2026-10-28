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

const KEY_ALIASES = {
  "daily-tests": "dailyTestRules",
  "daily-test-rules": "dailyTestRules",
  "result-visibility": "resultVisibility",
  "results": "resultVisibility",
};

function normalizeKey(req, res, next) {
  if (req.params.key && KEY_ALIASES[req.params.key]) {
    req.params.key = KEY_ALIASES[req.params.key];
  }
  next();
}

function authorizeSettingWrite(req, res, next) {
  const permission = permissionFor(req.params.key);
  if (permission && !can(req.user.role, permission)) {
    return next(new ApiError(403, "You cannot change this setting."));
  }
  return next();
}

const feeTypePolicy = require("../controllers/fee_type_policy");

router.get("/fee-type-policies", authorize("settings.fees.update"), feeTypePolicy.list);
router.put("/fee-type-policies", authorize("settings.fees.update"), feeTypePolicy.update);

router.get("/", authorize("settings.read"), c.getAll);
router.put("/:key", normalizeKey, authorizeRoles(writers), authorizeSettingWrite, validate(v.validateUpdate), c.update);

module.exports = router;
