"use strict";

/**
 * Deployment rules that depend on the environment, kept free of convict so they can be unit tested.
 *
 * Deployed environments (staging, production) serve the portal and the API from different sites, so the
 * refresh cookie must be `SameSite=None; Secure`, the app sits behind a proxy, and every critical setting
 * must come from the environment: nothing falls back to a localhost or placeholder default.
 */

const DEPLOYED_ENVS = ["staging", "production"];
const SAME_SITE_VALUES = ["lax", "strict", "none"];
const DEFAULT_JWT_SECRET = "change-me-in-production";
const MIN_JWT_SECRET_LENGTH = 32;

const isDeployed = (env) => DEPLOYED_ENVS.includes(env);

/** "true"/"false" (any case) or "" for unset. Anything else is an error. */
function parseBooleanSetting(name, raw) {
  const value = String(raw).trim().toLowerCase();
  if (value === "") return null;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`${name} must be "true" or "false".`);
}

/**
 * Refresh-cookie attributes. Deployed: SameSite=None + Secure by default; dev/test: Lax, not Secure
 * (plain http://localhost). COOKIE_SECURE / COOKIE_SAMESITE / COOKIE_DOMAIN override the defaults, and
 * SameSite=None without Secure is refused because browsers drop such cookies.
 */
function cookieSettings(env, { secure = "", sameSite = "", domain = "" } = {}) {
  const deployed = isDeployed(env);
  let resolvedSameSite = "lax";
  if (deployed) resolvedSameSite = "none";
  const requestedSameSite = String(sameSite).trim().toLowerCase();
  if (requestedSameSite) {
    if (!SAME_SITE_VALUES.includes(requestedSameSite)) throw new Error(`COOKIE_SAMESITE must be one of ${SAME_SITE_VALUES.join(", ")}.`);
    resolvedSameSite = requestedSameSite;
  }
  let resolvedSecure = deployed;
  const requestedSecure = parseBooleanSetting("COOKIE_SECURE", secure);
  if (requestedSecure !== null) resolvedSecure = requestedSecure;
  if (resolvedSameSite === "none" && !resolvedSecure) throw new Error("COOKIE_SAMESITE=none requires COOKIE_SECURE=true.");
  if (deployed && !resolvedSecure) throw new Error(`COOKIE_SECURE can't be false in ${env}.`);

  const settings = { secure: resolvedSecure, sameSite: resolvedSameSite };
  const trimmedDomain = String(domain).trim();
  if (trimmedDomain) settings.domain = trimmedDomain;
  return settings;
}

/**
 * Express "trust proxy" value. Deployed default: 1 (one hop: the platform's load balancer), so
 * req.secure and req.ip reflect the client. Dev/test default: false. TRUST_PROXY accepts
 * true/false, a hop count, or an Express trust string such as "loopback".
 */
function trustProxySetting(env, raw = "") {
  const value = String(raw).trim();
  if (value === "") {
    if (isDeployed(env)) return 1;
    return false;
  }
  if (/^\d+$/.test(value)) return Number(value);
  if (value.toLowerCase() === "true") return true;
  if (value.toLowerCase() === "false") return false;
  return value;
}

/** Comma-separated origins → trimmed list without trailing slashes or blanks. */
function parseOrigins(raw) {
  return String(raw)
    .split(",")
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter(Boolean);
}

/** Variables a deployed API refuses to start without, keyed by the value read from config. */
function requiredDeploySettings(values) {
  return [
    ["DATABASE_HOST", values.dbHost],
    ["DATABASE_PORT", values.dbPort],
    ["DATABASE_NAME", values.dbName],
    ["DATABASE_USERNAME", values.dbUsername],
    ["DATABASE_PASSWORD", values.dbPassword],
    ["JWT_SECRET", values.jwtSecret],
    ["FRONT_END_URL", values.frontEndUrl],
    ["ALLOWED_ORIGINS", values.allowedOrigins],
    ["CLOUDFLARE_R2_ACCESS_KEY_ID", values.r2AccessKeyId],
    ["CLOUDFLARE_R2_SECRET_ACCESS_KEY", values.r2SecretAccessKey],
    ["CLOUDFLARE_R2_BUCKET", values.r2Bucket],
    ["CLOUDFLARE_R2_ENDPOINT", values.r2Endpoint],
    ["RESEND_API_KEY", values.resendApiKey],
    ["EMAIL_FROM", values.emailFrom],
  ];
}

/**
 * Problems that stop a deployed API from starting: missing variables, a default or short JWT secret,
 * http/localhost URLs. Read from `env` (process.env) so convict defaults can't hide a missing value.
 * Returns [] in development and test.
 */
function deployProblems(nodeEnv, env) {
  if (!isDeployed(nodeEnv)) return [];
  const value = (name) => String(env[name] || "").trim();
  const values = {
    dbHost: value("DATABASE_HOST"),
    dbPort: value("DATABASE_PORT"),
    dbName: value("DATABASE_NAME"),
    dbUsername: value("DATABASE_USERNAME"),
    dbPassword: value("DATABASE_PASSWORD"),
    jwtSecret: value("JWT_SECRET"),
    frontEndUrl: value("FRONT_END_URL"),
    allowedOrigins: value("ALLOWED_ORIGINS"),
    r2AccessKeyId: value("CLOUDFLARE_R2_ACCESS_KEY_ID"),
    r2SecretAccessKey: value("CLOUDFLARE_R2_SECRET_ACCESS_KEY"),
    r2Bucket: value("CLOUDFLARE_R2_BUCKET"),
    r2Endpoint: value("CLOUDFLARE_R2_ENDPOINT"),
    resendApiKey: value("RESEND_API_KEY"),
    emailFrom: value("EMAIL_FROM"),
  };
  const problems = [];
  const missing = requiredDeploySettings(values).filter(([, found]) => !found).map(([name]) => name);
  if (missing.length) problems.push(`Missing: ${missing.join(", ")}`);
  if (values.jwtSecret === DEFAULT_JWT_SECRET || (values.jwtSecret && values.jwtSecret.length < MIN_JWT_SECRET_LENGTH)) {
    problems.push(`JWT_SECRET must be a random value of at least ${MIN_JWT_SECRET_LENGTH} characters, not the default.`);
  }
  const insecure = (url) => !/^https:\/\//i.test(url) || /localhost|127\.0\.0\.1/i.test(url);
  if (values.frontEndUrl && insecure(values.frontEndUrl)) problems.push("FRONT_END_URL must be an https URL that isn't localhost.");
  const badOrigins = parseOrigins(values.allowedOrigins).filter(insecure);
  if (badOrigins.length) problems.push(`ALLOWED_ORIGINS must be https and not localhost: ${badOrigins.join(", ")}`);
  if (values.r2Endpoint && !/^https:\/\//i.test(values.r2Endpoint)) problems.push("CLOUDFLARE_R2_ENDPOINT must be an https URL.");
  return problems;
}

/** Throws one error naming every problem, so a deploy fails at boot instead of running insecurely. */
function assertDeployable(nodeEnv, env) {
  const problems = deployProblems(nodeEnv, env);
  if (problems.length) {
    throw new Error(`Eduvia API can't start in ${nodeEnv}:\n- ${problems.join("\n- ")}\nSee .env.example and docs/DEPLOYMENT-STAGE.md.`);
  }
}

module.exports = {
  DEPLOYED_ENVS,
  DEFAULT_JWT_SECRET,
  MIN_JWT_SECRET_LENGTH,
  isDeployed,
  cookieSettings,
  trustProxySetting,
  parseOrigins,
  deployProblems,
  assertDeployable,
};
