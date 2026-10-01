"use strict";

const express = require("express");
const { authorize } = require("../middlewares/authorize");
const validate = require("../middlewares/validate");
const { noticeController: c } = require("../controllers");
const v = require("../validations/notice");

const router = express.Router();

router.get("/", authorize("updates.read"), validate(v.validateList), c.list);
router.post("/", authorize("updates.write"), validate(v.validateCreate), c.create);
router.patch("/:id/status", authorize("updates.review"), validate(v.validateUpdateStatus), c.setStatus);
router.delete("/:id", authorize("updates.review"), validate(v.validateId), c.remove);

module.exports = router;
