"use strict";

const Joi = require("joi");
const { STUDENT_STATUS, GENDER, LIFECYCLE_REASONS, LIFECYCLE_HISTORY_TYPES: HISTORY_TYPES } = require("../constants");
const { id, isoDay } = require("./common");

module.exports = {
  validateCreate: {
    body: Joi.object({
      fkClassId: Joi.number().integer().allow(null),
      admissionNo: Joi.string().required(),
      firstName: Joi.string().required(),
      lastName: Joi.string().required(),
      gender: Joi.string().valid(...Object.values(GENDER)).allow(null),
      dob: Joi.date().iso().allow(null),
      // New records start Pending or Active; later statuses come from the lifecycle (POST /:id/status).
      status: Joi.string().valid(STUDENT_STATUS.ACTIVE, STUDENT_STATUS.PENDING),
      admittedOn: Joi.date().iso().allow(null),
    }),
  },
  validateUpdate: {
    body: Joi.object({
      fkClassId: Joi.number().integer().allow(null),
      admissionNo: Joi.string(),
      firstName: Joi.string(),
      lastName: Joi.string(),
      gender: Joi.string().valid(...Object.values(GENDER)).allow(null),
      dob: Joi.date().iso().allow(null),
      admittedOn: Joi.date().iso().allow(null),
    }).min(1),
  },
  validateStatus: {
    params: Joi.object({ id: id.required() }),
    body: Joi.object({
      status: Joi.string().valid(...Object.values(STUDENT_STATUS)).required(),
      reason: Joi.string().trim().max(1000).required(),
      effectiveOn: isoDay.required(),
      reasonCategory: Joi.string().valid(...new Set(Object.values(LIFECYCLE_REASONS).flat())).allow(null),
      finalResult: Joi.string().trim().max(255).allow("", null),
      graduationOverride: Joi.boolean().default(false),
      academicStatus: Joi.string().trim().max(255).allow("", null),
      transferToSchool: Joi.string().trim().max(255).allow("", null),
      classId: id.allow(null),
      sessionId: id.allow(null),
    }),
  },
  validatePromote: {
    params: Joi.object({ id: id.required() }),
    body: Joi.object({
      classId: id.required(),
      sessionId: id,
      date: isoDay.required(),
    }),
  },
  validateBulkPromote: {
    body: Joi.object({
      fromClassId: id.required(),
      toClassId: id.allow(null),
      holdClassId: id.allow(null),
      sessionId: id.required(),
      date: isoDay.required(),
      graduationResult: Joi.string().trim().max(255).allow("", null),
      graduationOverride: Joi.boolean().default(false),
      students: Joi.array()
        .items(Joi.object({ studentId: id.required(), action: Joi.string().valid("promote", "hold", "graduate").required() }))
        .min(1)
        .max(500)
        .required(),
    }),
  },
  validatePromotionHistory: {
    query: Joi.object({
      page: Joi.number().integer().min(1).default(1),
      pageSize: Joi.number().integer().min(1).max(200).default(20),
      type: Joi.string().valid("Promotion", "Repeat", "Graduation", "New Admission"),
    }),
  },
  validateLifecycleHistory: {
    query: Joi.object({
      page: Joi.number().integer().min(1).default(1),
      pageSize: Joi.number().integer().min(1).max(200).default(20),
      type: Joi.alternatives(
        Joi.string().valid(...HISTORY_TYPES),
        Joi.array().items(Joi.string().valid(...HISTORY_TYPES)).max(HISTORY_TYPES.length),
      ),
      from: isoDay,
      to: isoDay,
      classId: id,
      sessionId: id,
      studentId: id,
      reasonCategory: Joi.string().max(40),
      q: Joi.string().trim().max(100).allow(""),
    }),
  },
  validateId: {
    params: Joi.object({ id: Joi.number().integer().required() }),
  },
};
