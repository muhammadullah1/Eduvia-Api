"use strict";

const convict = require("convict");
require("dotenv").config();

const config = convict({
  env: {
    doc: "The application environment.",
    format: ["production", "development", "staging", "test"],
    default: "development",
    env: "NODE_ENV",
  },
  ip: {
    doc: "The IP address to bind.",
    format: String,
    default: "127.0.0.1",
    env: "IP_ADDRESS",
  },
  port: {
    doc: "The port to bind.",
    format: Number,
    default: 8080,
    env: "PORT",
    arg: "port",
  },
  db: {
    host: {
      doc: "Database host name/IP",
      format: String,
      default: "127.0.0.1",
      env: "DATABASE_HOST",
    },
    name: {
      doc: "Database name",
      format: String,
      default: "database_development",
      env: "DATABASE_NAME",
    },
    username: {
      doc: "db user",
      format: String,
      default: "root",
      env: "DATABASE_USERNAME",
    },
    password: {
      doc: "db password",
      format: "*",
      default: "",
      env: "DATABASE_PASSWORD",
    },
    port: {
      doc: "db port",
      format: "*",
      default: "5432",
      env: "DATABASE_PORT",
    },
  },
  frontEndUrl: {
    doc: "Frontend URL",
    format: String,
    default: "http://localhost:5173",
    env: "FRONT_END_URL",
  },
  signInJwtSecret: {
    doc: "JWT secret for sign-in tokens",
    format: String,
    default: "change-me-in-production",
    env: "JWT_SECRET",
  },
  appVersion: {
    doc: "appVersion",
    format: String,
    default: "1.0.0",
    env: "APP_VERSION",
  },
});

const env = config.get("env");
if (env === "development" || env === "test") {
  const envFile = __dirname + "/environments/" + env + ".json";
  if (require("fs").existsSync(envFile)) {
    config.loadFile(envFile);
  }
}

config.validate({ allowed: "strict" });
module.exports = config;
