"use strict";

const express = require("express");
const { authorize } = require("../middlewares/authorize");
const validate = require("../middlewares/validate");
const { applicationController: c } = require("../controllers");
const v = require("../validations/application");

const router = express.Router();
const can = authorize("admissions.manage");

router.get("/", can, validate(v.validateList), c.list);
router.post("/drafts", can, validate(v.validateCreateDraft), c.createDraft);
router.get("/:id", can, validate(v.validateId), c.getById);
router.post("/", can, validate(v.validateCreate), c.create);
router.patch("/:id", can, validate(v.validateId), validate(v.validateUpdate), c.update);
router.post("/:id/submit", can, validate(v.validateId), c.submit);
router.post("/:id/review", can, validate(v.validateId), c.review);
router.post("/:id/decide", can, validate(v.validateDecide), c.decide);
router.post("/:id/enroll", can, validate(v.validateEnroll), c.enroll);

module.exports = router;
