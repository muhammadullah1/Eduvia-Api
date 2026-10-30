"use strict";

/**
 * Families are archived for the simplified concession flow.
 * List/get remain read-only for historical data; writes return 410.
 */
const express = require("express");
const { authorize } = require("../middlewares/authorize");
const validate = require("../middlewares/validate");
const c = require("../controllers/family");
const v = require("../validations/family");
const ApiError = require("../utils/ApiError");

const router = express.Router();

function gone(_req, _res, next) {
  next(
    new ApiError(
      410,
      "Families are archived. Use student Fee concession with the Sibling reason instead.",
    ),
  );
}

router.get("/", authorize("families.read"), c.list);
router.get("/:id", authorize("families.read"), validate(v.validateId), c.get);
router.post("/", authorize("families.manage"), gone);
router.post("/:id/verify", authorize("families.manage"), gone);
router.post("/:id/members", authorize("families.manage"), gone);
router.delete("/:id/members/:studentId", authorize("families.manage"), gone);
router.get("/:id/suggest-members", authorize("families.read"), validate(v.validateId), c.suggest);

module.exports = router;
