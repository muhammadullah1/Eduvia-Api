"use strict";

const express = require("express");
const { authorize } = require("../middlewares/authorize");
const systemNoticeService = require("../services/system_notice.service");

const router = express.Router();

/** Actionable notices for the signed-in user's role (Help popover). */
router.get("/", authorize("account.self"), async (req, res, next) => {
  try {
    const data = await systemNoticeService.list(req.user);
    res.status(200).json({ success: true, message: "System notices", data });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
