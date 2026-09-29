"use strict";

const express = require("express");
const router = express.Router();
const { subjectController } = require("../controllers");
const { authorizeRoles } = require("../middlewares/authorize_roles");
const { USER_ROLES, MGMT_ROLES } = require("../constants");
const validate = require("../middlewares/validate");
const { validateCreate, validateUpdate, validateId } = require("../validations/subject");

const all = [...MGMT_ROLES, USER_ROLES.TEACHER];
const mgmt = MGMT_ROLES;

router.get("/", authorizeRoles(all), subjectController.list);
router.post("/", authorizeRoles(mgmt), validate(validateCreate), subjectController.create);
router.patch("/:id", authorizeRoles(mgmt), validate(validateId), validate(validateUpdate), subjectController.update);
router.delete("/:id", authorizeRoles(mgmt), validate(validateId), subjectController.remove);

module.exports = router;
