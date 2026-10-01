"use strict";

const express = require("express");
const { authorize } = require("../middlewares/authorize");
const validate = require("../middlewares/validate");
const { parentController: c } = require("../controllers");
const v = require("../validations/parent");

const router = express.Router();
const manage = authorize("parents.manage");

router.get("/me/children", authorize("results.parent"), c.myChildren);
router.get("/", manage, c.list);
router.post("/", manage, validate(v.validateCreate), c.create);
router.post("/:id/link-student", manage, validate(v.validateLink), c.linkStudent);

module.exports = router;
