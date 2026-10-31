"use strict";

const Joi = require("joi");
const { id, idParam } = require("./common");
const { ALL_PERMISSION_KEYS } = require("../constants/permissions");
const { STAFF_PORTAL_ROLES } = require("../constants/roles");

const REASON_MIN = 5;
const REASON_MAX = 500;
const MAX_PERMISSIONS = ALL_PERMISSION_KEYS.length;

const reason = Joi.string().trim().min(REASON_MIN).max(REASON_MAX).required();
const version = Joi.number().integer().min(1).required();

module.exports = {
  validateId: idParam,
  validateUpdate: {
    ...idParam,
    body: Joi.object({
      permissions: Joi.array().items(Joi.string().valid(...ALL_PERMISSION_KEYS)).max(MAX_PERMISSIONS).unique().required(),
      reason,
      version,
    }),
  },
  validateReset: { ...idParam, body: Joi.object({ reason, version }) },
  validateChangeUserRole: {
    params: Joi.object({ userId: id.required() }),
    body: Joi.object({ role: Joi.string().valid(...STAFF_PORTAL_ROLES).required(), reason }),
  },
};
