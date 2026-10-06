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
  resend: {
    apiKey: {
      doc: "Resend API key",
      format: String,
      default: "",
      env: "RESEND_API_KEY",
    },
    fromEmail: {
      doc: "Default sender email address",
      format: String,
      default: "onboarding@resend.dev",
      env: "EMAIL_FROM",
    },
    fromName: {
      doc: "Default sender display name",
      format: String,
      default: "Eduvia",
      env: "EMAIL_FROM_NAME",
    },
  },
  cloudFareR2: {
    accountId: {
      doc: "Cloudflare Account ID",
      format: String,
      default: "",
      env: "R2_ACCOUNT_ID",
    },
    accessKeyId: {
      doc: "Cloudflare R2 Access Key ID",
      format: String,
      default: "",
      env: "R2_ACCESS_KEY_ID",
    },
    secretAccessKey: {
      doc: "Cloudflare R2 Secret Access Key",
      format: "*",
      default: "",
      env: "R2_SECRET_ACCESS_KEY",
    },
    bucket: {
      doc: "Cloudflare R2 Bucket Name",
      format: String,
      default: "",
      env: "R2_BUCKET",
    },
    endpoint: {
      doc: "Cloudflare R2 S3 API Endpoint",
      format: String,
      default: "",
      env: "R2_ENDPOINT",
    },
    publicBaseUrl: {
      doc: "Cloudflare R2 Public Base URL / Custom Domain",
      format: String,
      default: "",
      env: "R2_PUBLIC_BASE_URL",
    },
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

// Aliases for seamless access via 'r2' or 'cloudflareR2'
const originalGet = config.get.bind(config);
const originalHas = config.has.bind(config);

function mapProperty(sub) {
  if (sub === "bucketName") return "bucket";
  if (sub === "publicUrl") return "publicBaseUrl";
  return sub;
}

config.get = function (path) {
  if (path === "r2" || path === "cloudflareR2" || path === "cloudflare") {
    const val = originalGet("cloudFareR2");
    return {
      ...val,
      bucketName: val.bucket,
      publicUrl: val.publicBaseUrl,
    };
  }
  if (path === "cloudFareR2") {
    const val = originalGet("cloudFareR2");
    return {
      ...val,
      bucketName: val.bucket,
      publicUrl: val.publicBaseUrl,
    };
  }
  if (typeof path === "string") {
    if (
      path.startsWith("r2.") ||
      path.startsWith("cloudflareR2.") ||
      path.startsWith("cloudflare.") ||
      path.startsWith("cloudFareR2.")
    ) {
      const sub = mapProperty(path.substring(path.indexOf(".") + 1));
      return originalGet(`cloudFareR2.${sub}`);
    }
  }
  return originalGet(path);
};

config.has = function (path) {
  if (path === "r2" || path === "cloudflareR2" || path === "cloudflare") {
    return originalHas("cloudFareR2");
  }
  if (typeof path === "string") {
    if (
      path.startsWith("r2.") ||
      path.startsWith("cloudflareR2.") ||
      path.startsWith("cloudflare.") ||
      path.startsWith("cloudFareR2.")
    ) {
      const sub = mapProperty(path.substring(path.indexOf(".") + 1));
      return originalHas(`cloudFareR2.${sub}`);
    }
  }
  return originalHas(path);
};

module.exports = config;

