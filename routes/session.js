"use strict";

const express = require("express");
const { authorize } = require("../middlewares/authorize");
const validate = require("../middlewares/validate");
const { sessionController: c } = require("../controllers");
const v = require("../validations/session");

const router = express.Router();
const manage = authorize("academic.manage");

router.get("/", authorize("academic.read"), c.list);
router.post("/", manage, validate(v.validateCreate), c.create);
router.patch("/:id", manage, validate(v.validateId), validate(v.validateUpdate), c.update);
router.post("/:id/activate", manage, validate(v.validateId), c.activate);
router.delete("/:id", manage, validate(v.validateId), c.remove);

module.exports = router;
