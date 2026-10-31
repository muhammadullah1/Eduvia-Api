"use strict";

const express = require("express");
const { authorize } = require("../middlewares/authorize");
const validate = require("../middlewares/validate");
const { roleController: c } = require("../controllers");
const v = require("../validations/role");

const router = express.Router();
const manage = authorize("roles.manage");

router.get("/catalog", manage, c.catalog);
router.get("/", manage, c.list);
router.patch("/users/:userId", manage, validate(v.validateChangeUserRole), c.changeUserRole);
router.get("/:id", manage, validate(v.validateId), c.get);
router.get("/:id/users", manage, validate(v.validateId), c.users);
router.put("/:id/permissions", manage, validate(v.validateUpdate), c.updatePermissions);
router.post("/:id/reset", manage, validate(v.validateReset), c.reset);

module.exports = router;
