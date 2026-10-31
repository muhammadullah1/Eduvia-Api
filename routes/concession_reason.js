"use strict";

const express = require("express");
const { authorize } = require("../middlewares/authorize");
const validate = require("../middlewares/validate");
const c = require("../controllers/concession_reason");
const v = require("../validations/concession_reason");

const router = express.Router();

router.get("/", authorize("fees.concessions.read"), c.list);
router.post("/", authorize("settings.fees.update"), validate(v.validateCreate), c.create);
router.patch("/:id", authorize("settings.fees.update"), validate(v.validateUpdate), c.update);
router.delete("/:id", authorize("settings.fees.update"), validate(v.validateId), c.remove);

module.exports = router;
