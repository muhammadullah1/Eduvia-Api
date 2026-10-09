const config = require("../config");
const { PLATFORMS } = require("../constants");
const ApiError = require("../utils/ApiError");

const platformMiddleware = (req, res, next) => {
  try {
    const platformHeader = req.header("platform") || "webApp";

    const platform = PLATFORMS[platformHeader];
    if (!platform) {
      throw new ApiError(
        400,
        "Invalid platform: only mobile and webApp are supported",
      );
    }

    req.platform = platform.type;
    if (platform.requiresVersion) {
      const version = req.header("version");
      if (!version) {
        throw new ApiError(400, "Missing version header for mobile requests");
      }

      const appVersionStr = config.get("appVersion");
      const supportedVersions = appVersionStr
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);

      if (!supportedVersions.includes(version)) {
        throw new ApiError(
          426,
          "Update Required: Older app versions are no longer supported. Please update to the latest version to continue enjoying the app",
        );
      }
    }

    next();
  } catch (error) {
    next(error);
  }
};

module.exports = platformMiddleware;
