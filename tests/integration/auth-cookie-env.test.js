"use strict";

const bcrypt = require("bcryptjs");
const app = require("../../app");
const config = require("../../config");
const { sequelize } = require("../../models");
const refreshTokens = require("../../services/refresh_token.service");
const { request } = require("../helpers/http");
const { makeSchool, makeUser } = require("../helpers/school");

const COOKIE = refreshTokens.COOKIE_NAME;
const refreshHeader = (res) => [].concat(res.headers["set-cookie"] || []).find((c) => c.startsWith(`${COOKIE}=`));

/** Runs `fn` as if the API were in `env` (cookie attributes are read per request). */
async function asEnv(env, cookie, fn) {
  const previousEnv = config.get("env");
  const previousCookie = config.get("cookie");
  config.set("env", env);
  config.set("cookie", { secure: "", sameSite: "", domain: "", ...cookie });
  try {
    return await fn();
  } finally {
    config.set("env", previousEnv);
    config.set("cookie", previousCookie);
  }
}

describe("refresh cookie attributes per environment", () => {
  let user;
  const login = () =>
    request(app, {
      method: "POST",
      path: "/api/auth/login",
      body: { email: user.email, password: "secret123", schoolId: user.fkSchoolId },
    });

  beforeAll(async () => {
    await sequelize.authenticate();
    const { school } = await makeSchool();
    user = await makeUser(school.id, "super_admin");
    await user.update({ email: `cookie-env-${user.id}-${Date.now()}@example.com`, password: await bcrypt.hash("secret123", 4) });
  });

  test.each(["staging", "production"])("%s login and refresh set SameSite=None; Secure", async (env) => {
    await asEnv(env, {}, async () => {
      const loginRes = await login();
      expect(loginRes.status).toBe(200);
      const header = refreshHeader(loginRes);
      expect(header).toMatch(/SameSite=None/);
      expect(header).toMatch(/Secure/);
      expect(header).toMatch(/HttpOnly/);

      const raw = header.split(";").shift().slice(COOKIE.length + 1);
      const refreshRes = await request(app, { method: "POST", path: "/api/auth/refresh", cookie: `${COOKIE}=${raw}` });
      expect(refreshRes.status).toBe(200);
      const rotated = refreshHeader(refreshRes);
      expect(rotated).toMatch(/SameSite=None/);
      expect(rotated).toMatch(/Secure/);
    });
  });

  test("development login sets SameSite=Lax without Secure", async () => {
    await asEnv("development", {}, async () => {
      const header = refreshHeader(await login());
      expect(header).toMatch(/SameSite=Lax/);
      expect(header).not.toMatch(/Secure/);
    });
  });

  test("COOKIE_DOMAIN is applied when set", async () => {
    await asEnv("staging", { domain: "example.com" }, async () => {
      expect(refreshHeader(await login())).toMatch(/Domain=example\.com/);
    });
  });
});
