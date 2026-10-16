"use strict";

const express = require("express");
const { authorize } = require("../middlewares/authorize");
const validate = require("../middlewares/validate");
const { userController: c } = require("../controllers");
const v = require("../validations/user");

const router = express.Router();

router.get("/", authorize("users.read"), c.list);
router.post("/", authorize("users.create"), validate(v.validateCreate), c.create);
router.post(
  "/:id/resend-invitation",
  authorize("users.create"),
  validate(v.validateId),
  c.resendInvitation
);
router.patch(
  "/:id",
  authorize("users.create"),
  validate(v.validateUpdate),
  c.update
);
router.delete("/:id", authorize("users.create"), validate(v.validateId), c.remove);

module.exports = router;
