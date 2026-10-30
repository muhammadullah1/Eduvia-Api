"use strict";

const http = require("http");
const config = require("./config");
const app = require("./app");
const logger = require("./utils/logger");
const permissionService = require("./services/permission.service");

const port = config.get("port") || 4000;
const server = http.createServer(app);

permissionService
  .ready()
  .then(() => {
    server.listen(port, () => {
      logger.info({ port }, "Eduvia API listening");
    });
  })
  .catch((error) => {
    logger.error({ err: error }, "Permission catalog sync failed");
    process.exitCode = 1;
  });
