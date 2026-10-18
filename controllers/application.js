"use strict";

const { applicationService } = require("../services");
const { buildPagination } = require("../utils");
const { serializeApplication } = require("../utils/applicationSerializer");

function serializeEnrollResult(result) {
  if (!result) return result;
  return {
    application: serializeApplication(result.application),
    student: result.student,
  };
}

module.exports = {
  summary: async (req, res, next) => {
    try {
      const counts = await applicationService.statusSummary(req.user.schoolId);
      res.status(200).json({
        success: true,
        message: "Application summary fetched",
        data: counts,
      });
    } catch (err) {
      next(err);
    }
  },
  list: async (req, res, next) => {
    try {
      const result = await applicationService.list(req.user.schoolId, req.query);
      const applications = result.rows.map(serializeApplication);
      res.status(200).json({
        success: true,
        message: "Applications fetched successfully",
        data: buildPagination(
          applications,
          result.count,
          result.page,
          result.pageSize,
          "applications",
        ),
      });
    } catch (err) {
      next(err);
    }
  },
  getById: async (req, res, next) => {
    try {
      const row = await applicationService.getById(req.params.id, req.user.schoolId);
      res.status(200).json({
        success: true,
        message: "Application fetched successfully",
        data: serializeApplication(row),
      });
    } catch (err) {
      next(err);
    }
  },
  createDraft: async (req, res, next) => {
    try {
      const row = await applicationService.createDraft(req.user.schoolId, req.body);
      res.status(201).json({
        success: true,
        message: "Draft application created",
        data: serializeApplication(row),
      });
    } catch (err) {
      next(err);
    }
  },
  create: async (req, res, next) => {
    try {
      const row = await applicationService.create(req.user.schoolId, req.body);
      res.status(201).json({
        success: true,
        message: "Application created",
        data: serializeApplication(row),
      });
    } catch (err) {
      next(err);
    }
  },
  update: async (req, res, next) => {
    try {
      const row = await applicationService.update(
        req.params.id,
        req.user.schoolId,
        req.body,
      );
      res.status(200).json({
        success: true,
        message: "Application updated",
        data: serializeApplication(row),
      });
    } catch (err) {
      next(err);
    }
  },
  submit: async (req, res, next) => {
    try {
      const row = await applicationService.submit(req.params.id, req.user.schoolId);
      res.status(200).json({
        success: true,
        message: "Application submitted",
        data: serializeApplication(row),
      });
    } catch (err) {
      next(err);
    }
  },
  review: async (req, res, next) => {
    try {
      const row = await applicationService.markUnderReview(
        req.params.id,
        req.user.schoolId,
      );
      res.status(200).json({
        success: true,
        message: "Application marked under review",
        data: serializeApplication(row),
      });
    } catch (err) {
      next(err);
    }
  },
  decide: async (req, res, next) => {
    try {
      const row = await applicationService.decide(
        req.params.id,
        req.user.schoolId,
        req.body.decision,
        req.body.remarks,
      );
      res.status(200).json({
        success: true,
        message: "Decision recorded",
        data: serializeApplication(row),
      });
    } catch (err) {
      next(err);
    }
  },
  enroll: async (req, res, next) => {
    try {
      const result = await applicationService.enroll(
        req.params.id,
        req.user.schoolId,
        req.body,
        req.user,
      );
      res.status(200).json({
        success: true,
        message: "Student enrolled",
        data: serializeEnrollResult(result),
      });
    } catch (err) {
      next(err);
    }
  },
  presignDocument: async (req, res, next) => {
    try {
      const data = await applicationService.presignDocumentUpload(
        req.params.id,
        req.user.schoolId,
        req.body,
      );
      res.status(200).json({
        success: true,
        message: "Upload URL created",
        data,
      });
    } catch (err) {
      next(err);
    }
  },
  clearDocument: async (req, res, next) => {
    try {
      const row = await applicationService.clearDocumentFile(
        req.params.id,
        req.user.schoolId,
        req.params.documentId,
      );
      res.status(200).json({
        success: true,
        message: "Document cleared",
        data: serializeApplication(row),
      });
    } catch (err) {
      next(err);
    }
  },
};
