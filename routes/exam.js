"use strict";

const express = require("express");
const { authorize } = require("../middlewares/authorize");
const validate = require("../middlewares/validate");
const { examController: c } = require("../controllers");
const v = require("../validations/exam");

const router = express.Router();
const override = authorize("results.override");

router.get("/parent-results", authorize("results.parent"), validate(v.validateParentResults), c.parentResults);
router.get("/overrides", override, validate(v.validateOverrideList), c.listOverrides);
router.delete("/overrides/:overrideId", override, validate(v.validateRevoke), c.revokeOverride);
router.get("/sheets/:sheetId", authorize("exams.marks"), validate(v.validateSheet), c.getSheet);
router.put("/sheets/:sheetId/rows", authorize("exams.marks"), validate(v.validateRows), c.updateRows);
router.post("/sheets/:sheetId/submit", authorize("exams.marks"), validate(v.validateSheet), c.submit);
router.post("/sheets/:sheetId/verify", authorize("exams.verify"), validate(v.validateSheet), c.verify);
router.post("/sheets/:sheetId/publish", authorize("exams.publish"), validate(v.validateSheet), c.publish);
router.post("/sheets/:sheetId/reopen", authorize("exams.verify"), validate(v.validateSheet), c.reopen);
router.get("/", authorize("exams.read"), validate(v.validateList), c.list);
router.post("/", authorize("exams.create"), validate(v.validateCreate), c.create);
router.get("/:id/dmc", authorize("exams.read"), validate(v.validateDmc), c.dmc);
router.get("/:id", authorize("exams.read"), validate(v.validateId), c.getById);
router.get("/:id/visibility", override, validate(v.validateId), c.gateStatus);
router.post("/:id/overrides", override, validate(v.validateOverride), c.grantOverride);

module.exports = router;
