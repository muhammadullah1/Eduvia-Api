"use strict";

const http = require("http");
const config = require("./config");
const app = require("./app");
const logger = require("./utils/logger");

const port = config.get("port") || 4000;
const server = http.createServer(app);

server.listen(port, () => {
  logger.info({ port }, "Eduvia API listening");
});
