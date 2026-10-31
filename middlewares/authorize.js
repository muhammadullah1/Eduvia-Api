"use strict";

const { assertKnownPermission } = require("../constants/permissions");
const ApiError = require("../utils/ApiError");
const { authenticate } = require("./authenticate");

/**
 * Route guard by capability (constants/permissions.js). Keys are checked when the route is
 * declared, so a typo fails at startup. With several keys, holding any one of them is enough.
 */
function authorize(...keys) {
  if (!keys.length) throw new Error("authorize() needs at least one permission key");
  keys.forEach(assertKnownPermission);

  return async (req, res, next) => {
    try {
      const user = await authenticate(req);
      if (!keys.some((key) => user.permissions.has(key))) {
        throw new ApiError(403, "Access Denied. You don't have permission.");
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

module.exports = { authorize };
