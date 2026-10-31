"use strict";

/**
 * pm2 process file used by .github/workflows/deploy-api.yml. Settings come from the server's .env
 * (loaded by config/index.js); this file holds no secrets. Cluster mode lets `pm2 reload` restart
 * instances one at a time, so the API keeps serving during a deploy.
 *
 * The app name must match the PM2_APP_NAME variable of the GitHub environment.
 */
const INSTANCES = 2;
const KILL_TIMEOUT_MS = 10000;

module.exports = {
  apps: [
    {
      name: process.env.PM2_APP_NAME || "eduvia-api",
      script: "server.js",
      cwd: __dirname,
      exec_mode: "cluster",
      instances: INSTANCES,
      kill_timeout: KILL_TIMEOUT_MS,
      max_memory_restart: "512M",
      time: true,
    },
  ],
};
