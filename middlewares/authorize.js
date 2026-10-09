"use strict";

const { authorizeRoles } = require("./authorize_roles");
const { rolesFor } = require("../constants/permissions");

/**
 * Route guard by capability name (see constants/permissions.js).
 * Resolved at boot so a typo in a route fails fast instead of silently.
 */
function authorize(permission) {
  return authorizeRoles(rolesFor(permission));
}

module.exports = { authorize };
