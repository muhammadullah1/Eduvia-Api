"use strict";

const express = require("express");
const { authorize } = require("../middlewares/authorize");
const validate = require("../middlewares/validate");
const { settingsController: c } = require("../controllers");
const v = require("../validations/settings");

const router = express.Router();

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

const feeTypePolicy = require("../controllers/fee_type_policy");

router.get("/fee-type-policies", authorize("settings.fees.update"), feeTypePolicy.list);
router.put("/fee-type-policies", authorize("settings.fees.update"), feeTypePolicy.update);

router.get("/", authorize("settings.read"), c.getAll);
router.put("/:key", normalizeKey, authorize("settings.academic.update", "settings.fees.update"), validate(v.validateUpdate), c.update);

module.exports = router;
