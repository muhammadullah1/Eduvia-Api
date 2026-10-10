"use strict";

const express = require("express");
const { authorize } = require("../middlewares/authorize");
const validate = require("../middlewares/validate");
const { leaveController: c } = require("../controllers");
const v = require("../validations/leave");

const router = express.Router();

router.get("/", authorize("leave.read"), validate(v.validateList), c.list);
router.post("/", authorize("leave.request"), validate(v.validateCreate), c.create);
router.post("/:id/review", authorize("leave.review"), validate(v.validateReview), c.review);

module.exports = router;
