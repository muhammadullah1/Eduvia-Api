"use strict";

const Joi = require("joi");
const { isValidPhonePk } = require("../utils/pakistan");

const phoneSchema = Joi.string().custom((value, helpers) => {
  if (!value || !String(value).trim()) return value;
  if (!isValidPhonePk(value)) {
    return helpers.error("any.invalid");
  }
  return value;
}, "Pakistani mobile");

const docSchema = Joi.object({
  id: Joi.alternatives().try(Joi.number().integer(), Joi.string()),
  label: Joi.string().required(),
  status: Joi.string().valid("Pending", "Uploaded", "Verified", "Rejected"),
  fileUrl: Joi.string()
    .pattern(/^(https?:\/\/|pending:\/\/)/)
    .allow("", null),
});

const interviewDateSchema = Joi.date().iso().allow(null).custom((value, helpers) => {
  if (!value) return value;
  const d = new Date(value);
  const iso = d.toISOString().slice(0, 10);
  const min = new Date().toISOString().slice(0, 10);
  const maxDate = new Date();
  maxDate.setMonth(maxDate.getMonth() + 18);
  const max = maxDate.toISOString().slice(0, 10);
  if (iso < min || iso > max) {
    return helpers.message(`Interview date must be between ${min} and ${max}`);
  }
  return value;
});

module.exports = {
  validateList: {
    query: Joi.object({
      status: Joi.string().valid("New", "Review", "Waitlist", "Enrolled", "Rejected"),
      q: Joi.string().max(120).allow(""),
      submitted: Joi.string().valid("true", "false"),
      hasInterview: Joi.string().valid("true", "false"),
      page: Joi.number().integer().min(1).default(1),
      pageSize: Joi.number().integer().min(1).max(200).default(10),
    }),
  },
  validateCreateDraft: {
    body: Joi.object({
      name: Joi.string().allow("", null),
      fkClassId: Joi.number().integer().allow(null),
      guardian: Joi.string().allow("", null),
      phone: phoneSchema.allow("", null).messages({
        "any.invalid": "Enter a valid Pakistani mobile number",
      }),
      email: Joi.string().email().allow("", null),
      dob: Joi.date().iso().allow(null),
      gender: Joi.string().valid("Male", "Female", "Other"),
      address: Joi.string().allow("", null),
      previousSchool: Joi.string().allow("", null),
      previousClass: Joi.string().allow("", null),
      guardianRelation: Joi.string().allow("", null),
      guardianAddress: Joi.string().allow("", null),
      interviewType: Joi.string().allow("", null),
      interviewDate: interviewDateSchema,
      interviewScore: Joi.string().allow("", null),
      interviewResult: Joi.string().allow("", null),
      notes: Joi.string().allow("", null),
      documents: Joi.array().items(docSchema),
    }),
  },
  validateCreate: {
    body: Joi.object({
      name: Joi.string().required(),
      fkClassId: Joi.number().integer().required(),
      guardian: Joi.string().required(),
      phone: phoneSchema.required().messages({
        "any.invalid": "Enter a valid Pakistani mobile number",
      }),
      email: Joi.string().email().allow("", null),
      dob: Joi.date().iso().required(),
      gender: Joi.string().valid("Male", "Female", "Other").required(),
      address: Joi.string().allow("", null),
      previousSchool: Joi.string().allow("", null),
      previousClass: Joi.string().allow("", null),
      guardianRelation: Joi.string().allow("", null),
      guardianAddress: Joi.string().allow("", null),
      interviewType: Joi.string().allow("", null),
      interviewDate: interviewDateSchema,
      interviewScore: Joi.string().allow("", null),
      interviewResult: Joi.string().allow("", null),
      decision: Joi.string().valid("Admit", "Reject", "Waitlist", "").allow(null),
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
      phone: phoneSchema.messages({
        "any.invalid": "Enter a valid Pakistani mobile number",
      }),
      dob: Joi.date().iso().allow(null),
      email: Joi.string().email().allow("", null),
      gender: Joi.string().valid("Male", "Female", "Other"),
      address: Joi.string().allow("", null),
      previousSchool: Joi.string().allow("", null),
      previousClass: Joi.string().allow("", null),
      guardianRelation: Joi.string().allow("", null),
      guardianAddress: Joi.string().allow("", null),
      interviewType: Joi.string().allow("", null),
      interviewDate: interviewDateSchema,
      interviewScore: Joi.string().allow("", null),
      interviewResult: Joi.string().allow("", null),
      decision: Joi.string().valid("Admit", "Reject", "Waitlist", "").allow(null),
      notes: Joi.string().allow("", null),
      documents: Joi.array().items(docSchema),
    }).min(1),
  },
  validateDecide: {
    params: Joi.object({ id: Joi.number().integer().required() }),
    body: Joi.object({
      decision: Joi.string().valid("Admit", "Reject", "Waitlist").required(),
      remarks: Joi.string().allow("", null),
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
  validateDocumentId: {
    params: Joi.object({
      id: Joi.number().integer().required(),
      documentId: Joi.number().integer().required(),
    }),
  },
  validatePresignDocument: {
    body: Joi.object({
      documentId: Joi.number().integer().required(),
      contentType: Joi.string()
        .valid(
          "application/pdf",
          "image/jpeg",
          "image/png",
          "image/webp",
        )
        .required(),
      fileName: Joi.string().max(200).required(),
    }),
  },
};
