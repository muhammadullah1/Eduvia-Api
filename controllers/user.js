"use strict";

const { userService } = require("../services");
const { buildPagination } = require("../utils");

module.exports = {
  list: async (req, res, next) => {
    try {
      const { role, page, pageSize } = req.query;
      const result = await userService.listBySchool(req.user.schoolId, { role, page, pageSize });
      res.status(200).json({
        success: true,
        message: "Users",
        data: buildPagination(result.rows, result.count, result.page, result.pageSize, "users"),
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
};
