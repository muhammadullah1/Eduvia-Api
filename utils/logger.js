const pino = require("pino");
const pinoHttp = require("pino-http");

const isDev = process.env.NODE_ENV !== "production";

const logger = pino({
  level: process.env.LOG_LEVEL || (isDev ? "debug" : "info"),
  base: {
    env: process.env.NODE_ENV || "development",
  },
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  ...(isDev && {
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "SYS:standard",
        ignore: "pid,hostname",
        singleLine: false,
        errorLikeObjectKeys: ["err", "error"],
      },
    },
  }),
});

function logError(err, extra = {}) {
  const payload = {
    msg: err.message,
    err: {
      type: err.name,
      message: err.message,
      stack: err.stack,
      code: err.code,
      statusCode: err.statusCode || err.status,
    },
    ...extra,
  };
  logger.error(payload);
}

function setupProcessHandlers() {
  process.on("uncaughtException", (err) => {
    logError(err, { uncaught: true });
    process.exit(1);
  });
  process.on("unhandledRejection", (reason, promise) => {
    logger.error({ err: reason, promise, msg: "Unhandled Rejection" });
  });
}

const requestLogger = pinoHttp({
  logger,
  autoLogging: {
    ignore: (req) => req.url === "/api/test" || req.url === "/health",
  },
  customLogLevel: (req, res, err) => {
    if (res.statusCode >= 500 || err) return "error";
    if (res.statusCode >= 400) return "warn";
    return "info";
  },
  customSuccessMessage: (req, res) => {
    return `${req.method} ${req.url} ${res.statusCode}`;
  },
  customErrorMessage: (req, res, err) => {
    return `${req.method} ${req.url} ${res.statusCode} - ${(err && err.message) || res.statusMessage}`;
  },
  serializers: {
    req: (req) => ({
      id: req.id,
      method: req.method,
      url: req.url,
      query: req.query,
      params: req.params,
    }),
    res: (res) => ({
      statusCode: res.statusCode,
    }),
  },
});

module.exports = logger;
module.exports.logError = logError;
module.exports.setupProcessHandlers = setupProcessHandlers;
module.exports.requestLogger = requestLogger;
