"use strict";

const { userService } = require("../services");
const { buildPagination } = require("../utils");
const storageService = require("../services/storage.service");

/** Avatars live in the private bucket: attach a signed link for display. */
async function withPhotoUrl(user) {
  const json = typeof user.toJSON === "function" ? user.toJSON() : { ...user };
  json.photoUrl = null;
  if (storageService.isObjectKey(json.photo) && storageService.storageConfig()) {
    json.photoUrl = (await storageService.signedDownloadUrl(json.photo, AVATAR_LINK_SECONDS)).url;
  }
  return json;
}

const AVATAR_LINK_SECONDS = 3600;

module.exports = {
  list: async (req, res, next) => {
    try {
      const { role, page, pageSize } = req.query;
      const archived = req.query.archived === "1" || req.query.archived === "true";
      const result = await userService.listBySchool(req.user.schoolId, {
        role,
        page,
        pageSize,
        archived,
      });
      res.status(200).json({
        success: true,
        message: "Users",
        data: buildPagination(await Promise.all(result.rows.map(withPhotoUrl)), result.count, result.page, result.pageSize, "users"),
      });
    } catch (err) {
      next(err);
    }
  },
  create: async (req, res, next) => {
    try {
      const user = await userService.createStaffUser(req.user, req.body);
      res.status(201).json({ success: true, message: "User created", data: user });
    } catch (err) {
      next(err);
    }
  },
  resendInvitation: async (req, res, next) => {
    try {
      const data = await userService.resendInvitation(req.user, Number(req.params.id));
      res.status(200).json({
        success: true,
        message: "Activation email sent",
        data,
      });
    } catch (err) {
      next(err);
    }
  },
  update: async (req, res, next) => {
    try {
      const user = await userService.updateStaffUser(req.user, Number(req.params.id), req.body);
      res.status(200).json({ success: true, message: "User updated", data: user });
    } catch (err) {
      next(err);
    }
  },
  restore: async (req, res, next) => {
    try {
      const data = await userService.restoreStaffUser(req.user, Number(req.params.id));
      res.status(200).json({ success: true, message: "User restored", data });
    } catch (err) {
      next(err);
    }
  },
  remove: async (req, res, next) => {
    try {
      const data = await userService.removeStaffUser(req.user, Number(req.params.id));
      res.status(200).json({ success: true, message: "User removed", data });
    } catch (err) {
      next(err);
    }
  },
};
