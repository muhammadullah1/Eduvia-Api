"use strict";

const Joi = require("joi");

const docSchema = Joi.object({
  id: Joi.number().integer(),
  label: Joi.string().required(),
  status: Joi.string().valid("Pending", "Uploaded", "Verified"),
});

module.exports = {
  validateCreate: {
    body: Joi.object({
      name: Joi.string().required(),
      fkClassId: Joi.number().integer().allow(null),
      guardian: Joi.string().required(),
      phone: Joi.string().required(),
      dob: Joi.date().iso().allow(null),
      gender: Joi.string().valid("Male", "Female").allow(null),
      address: Joi.string().allow("", null),
      previousSchool: Joi.string().allow("", null),
      previousClass: Joi.string().allow("", null),
      guardianRelation: Joi.string().allow("", null),
      guardianAddress: Joi.string().allow("", null),
      interviewType: Joi.string().allow("", null),
      interviewDate: Joi.date().iso().allow(null),
      interviewScore: Joi.string().allow("", null),
      interviewResult: Joi.string().allow("", null),
      notes: Joi.string().allow("", null),
      submittedOn: Joi.date().iso().allow(null),
      documents: Joi.array().items(docSchema),
    }),
  },
  validateUpdate: {
    body: Joi.object({
      name: Joi.string(),
      fkClassId: Joi.number().integer().allow(null),
      guardian: Joi.string(),
      phone: Joi.string(),
      dob: Joi.date().iso().allow(null),
      gender: Joi.string().valid("Male", "Female").allow(null),
      address: Joi.string().allow("", null),
      previousSchool: Joi.string().allow("", null),
      previousClass: Joi.string().allow("", null),
      guardianRelation: Joi.string().allow("", null),
      guardianAddress: Joi.string().allow("", null),
      interviewType: Joi.string().allow("", null),
      interviewDate: Joi.date().iso().allow(null),
      interviewScore: Joi.string().allow("", null),
      interviewResult: Joi.string().allow("", null),
      notes: Joi.string().allow("", null),
      status: Joi.string().valid("New", "Review", "Waitlist", "Enrolled", "Rejected"),
      documents: Joi.array().items(docSchema),
    }).min(1),
  },
  validateDecide: {
    params: Joi.object({ id: Joi.number().integer().required() }),
    body: Joi.object({
      decision: Joi.string().valid("Admit", "Reject", "Waitlist").required(),
    }),
  },
  validateEnroll: {
    params: Joi.object({ id: Joi.number().integer().required() }),
    body: Joi.object({
      admissionNo: Joi.string().allow("", null),
    }),
  },
  validateId: {
    params: Joi.object({ id: Joi.number().integer().required() }),
  },
};
