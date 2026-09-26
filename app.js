const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const helmet = require("helmet");
const router = require("./routes");
const ApiError = require("./utils/ApiError");
const { isDbConnectivityError } = require("./utils/errors");
const { ALLOWED_ORIGINS } = require("./constants");
const logger = require("./utils/logger");

logger.setupProcessHandlers();

const app = express();

app.use(express.static("assets"));
app.use(bodyParser.json({ limit: "1mb" }));
app.use(
  bodyParser.urlencoded({
    limit: "1mb",
    extended: true,
    parameterLimit: 50000,
  }),
);
app.use(logger.requestLogger);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || ALLOWED_ORIGINS.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "platform", "version"],
  }),
);
app.use(helmet());

app.get("/health", (req, res) => {
  res.status(200).json({ ok: true, timestamp: new Date().toISOString() });
});

app.use("/api", router);

app.use((req, res) => {
  if (req.log)
    req.log.warn({ url: req.url, method: req.method }, "Route not found");
  return res.status(404).send({
    success: false,
    message: "Route / Endpoint not found",
  });
});

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);

  const statusCode = err.statusCode || err.status || err.code || 500;
  let message = err.message || "Internal Server Error";

  if (!(err instanceof ApiError) && isDbConnectivityError(err, message)) {
    message = "Connection error. Please contact support.";
  }

  res.err = err;

  return res.status(statusCode).send({
    success: false,
    message,
    data: err.data,
  });
});

module.exports = app;
