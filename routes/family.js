"use strict";

const express = require("express");
const { authorize } = require("../middlewares/authorize");
const validate = require("../middlewares/validate");
const c = require("../controllers/family");
const v = require("../validations/family");

const router = express.Router();

router.post("/", authorize("families.manage"), validate(v.validateCreate), c.create);
router.get("/", authorize("families.read"), c.list);
router.get("/:id", authorize("families.read"), validate(v.validateId), c.get);
router.post("/:id/verify", authorize("families.manage"), validate(v.validateId), c.verify);
router.post("/:id/members", authorize("families.manage"), validate(v.validateMember), c.addMember);
router.delete("/:id/members/:studentId", authorize("families.manage"), validate(v.validateRemoveMember), c.removeMember);
router.get("/:id/suggest-members", authorize("families.read"), validate(v.validateId), c.suggest);

module.exports = router;
