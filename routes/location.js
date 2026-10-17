"use strict";

const express = require("express");
const { authorize } = require("../middlewares/authorize");
const validate = require("../middlewares/validate");
const { locationController: c } = require("../controllers");
const v = require("../validations/location");

const router = express.Router();
const manage = authorize("academic.manage");

router.get("/", authorize("settings.read"), validate(v.validateList), c.list);
router.post("/", manage, validate(v.validateCreate), c.create);
router.put("/:id", manage, validate(v.validateUpdate), c.update);
router.delete("/:id", manage, validate(v.validateId), c.remove);
router.post("/:id/restore", manage, validate(v.validateId), c.restore);

module.exports = router;
