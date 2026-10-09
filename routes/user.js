"use strict";

const express = require("express");
const { authorize } = require("../middlewares/authorize");
const validate = require("../middlewares/validate");
const { userController: c } = require("../controllers");
const v = require("../validations/user");

const router = express.Router();

router.get("/", authorize("users.read"), c.list);
router.post("/", authorize("users.create"), validate(v.validateCreate), c.create);

module.exports = router;
