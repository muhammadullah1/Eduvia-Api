"use strict";

const { settingsService, dailyTestService } = require("../services");
const { SETTING_KEYS } = require("../constants");
const { handle } = require("../utils/handler");

module.exports = {
  getAll: handle("Settings", (req) => settingsService.getAll(req.user.schoolId)),
  update: handle("Setting saved", async (req) => {
    const value = await settingsService.update(req.user, req.params.key, req.body);
    if (req.params.key === SETTING_KEYS.DAILY_TEST_RULES) await dailyTestService.recomputeAll(req.user);
    return value;
  }),
};
