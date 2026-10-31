"use strict";

const express = require("express");
const { authorize } = require("../middlewares/authorize");
const validate = require("../middlewares/validate");
const { studentController: c } = require("../controllers");
const v = require("../validations/student");

const router = express.Router();
const manage = authorize("students.manage");

router.get("/", authorize("students.read"), c.list);
router.get("/promotions/history", manage, validate(v.validatePromotionHistory), c.promotionHistory);
router.post("/promotions/bulk", manage, validate(v.validateBulkPromote), c.bulkPromote);
router.get("/lifecycle/history", manage, validate(v.validateLifecycleHistory), c.lifecycleHistory);
router.get("/:id/lifecycle", manage, validate(v.validateId), c.lifecycle);
router.get("/:id", authorize("students.read"), validate(v.validateId), c.getById);
router.post("/", manage, validate(v.validateCreate), c.create);
router.patch("/:id", manage, validate(v.validateId), validate(v.validateUpdate), c.update);
router.put("/:id/photo", manage, validate(v.validatePhoto), c.setPhoto);
router.post("/:id/status", manage, validate(v.validateStatus), c.changeStatus);
router.post("/:id/promote", manage, validate(v.validatePromote), c.promote);
router.delete("/:id", manage, validate(v.validateId), c.remove);

module.exports = router;
