const authService = require("../services/auth.service");
const ApiError = require("../utils/ApiError");

function authorizeRoles(allowedRoles = []) {
  return async (req, res, next) => {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        throw new ApiError(401, "Unauthorized. No token provided.");
      }

      const token = authHeader.split(" ")[1];
      const { valid, expired, decoded } = authService.verifyToken(token);

      if (!valid) {
        throw new ApiError(
          401,
          expired ? "Ooops Token expired" : "Invalid token",
        );
      }

      const user = await authService.findUserForAuth(
        decoded.id || decoded.userId,
      );

      if (!user) {
        throw new ApiError(401, "Unauthorized. User not found.");
      }

      if (user.status === "block") {
        throw new ApiError(401, "Access Denied. Account deleted or blocked.");
      }

      req.user = {
        id: user.id,
        schoolId: user.fkSchoolId,
        role: user.role,
        email: decoded.email,
      };

      if (!allowedRoles.includes(req.user.role)) {
        throw new ApiError(403, "Access Denied. You don't have permission.");
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

module.exports = { authorizeRoles };
