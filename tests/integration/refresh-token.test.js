"use strict";

const bcrypt = require("bcryptjs");
const app = require("../../app");
const { sequelize, RefreshTokens } = require("../../models");
const refreshTokens = require("../../services/refresh_token.service");
const { verifyToken } = require("../../utils");
const { request } = require("../helpers/http");
const { makeSchool, makeUser } = require("../helpers/school");

const COOKIE = refreshTokens.COOKIE_NAME;
const cookieFrom = (res) => {
  const header = [].concat(res.headers["set-cookie"] || []).find((c) => c.startsWith(`${COOKIE}=`));
  return header ? header.split(";")[0].slice(COOKIE.length + 1) : null;
};
const refresh = (raw) =>
  request(app, { method: "POST", path: "/api/auth/refresh", cookie: raw ? `${COOKIE}=${raw}` : undefined });

describe("refresh tokens", () => {
  let user;
  beforeAll(async () => {
    await sequelize.authenticate();
    const { school } = await makeSchool();
    user = await makeUser(school.id, "super_admin");
    // Login validation needs a real TLD.
    await user.update({ email: `refresh-${user.id}-${Date.now()}@example.com`, password: await bcrypt.hash("secret123", 4) });
  });

  test("login sets an httpOnly refresh cookie, stores only its hash and returns a 15-minute access token", async () => {
    const res = await request(app, {
      method: "POST",
      path: "/api/auth/login",
      body: { email: user.email, password: "secret123", schoolId: user.fkSchoolId },
    });
    expect(res.status).toBe(200);
    const header = [].concat(res.headers["set-cookie"]).find((c) => c.startsWith(`${COOKIE}=`));
    expect(header).toMatch(/HttpOnly/);
    expect(header).toMatch(/Path=\/api\/auth/);
    const raw = cookieFrom(res);
    expect(await RefreshTokens.count({ where: { tokenHash: raw } })).toBe(0);
    expect(await RefreshTokens.count({ where: { tokenHash: refreshTokens.hash(raw) } })).toBe(1);
    const { decoded } = verifyToken(res.body.data.token);
    expect(decoded.exp - decoded.iat).toBe(15 * 60);
  });

  test("refresh rotates: new access token and cookie, old token revoked", async () => {
    const { raw } = await refreshTokens.issue(user.id);
    const res = await refresh(raw);
    expect(res.status).toBe(200);
    expect(verifyToken(res.body.data.token).valid).toBe(true);
    const next = cookieFrom(res);
    expect(next).toBeTruthy();
    expect(next).not.toBe(raw);
    const old = await RefreshTokens.findOne({ where: { tokenHash: refreshTokens.hash(raw) } });
    expect(old.revokedAt).not.toBeNull();
    expect(old.replacedById).not.toBeNull();
  });

  test("two clients refreshing with the same token at once both succeed (grace window)", async () => {
    const { raw, row } = await refreshTokens.issue(user.id);
    const [a, b] = await Promise.all([refresh(raw), refresh(raw)]);
    expect([a.status, b.status]).toEqual([200, 200]);
    const ca = cookieFrom(a);
    const cb = cookieFrom(b);
    expect(ca).not.toBe(cb);
    // Both new tokens keep working; the family is intact.
    expect((await refresh(ca)).status).toBe(200);
    expect((await refresh(cb)).status).toBe(200);
    expect(await RefreshTokens.count({ where: { familyId: row.familyId, revokedAt: null } })).toBe(2);
  });

  test("the grace is single-use: a third presentation is reuse", async () => {
    const { raw, row } = await refreshTokens.issue(user.id);
    expect((await refresh(raw)).status).toBe(200);
    expect((await refresh(raw)).status).toBe(200);
    expect((await refresh(raw)).status).toBe(401);
    expect(await RefreshTokens.count({ where: { familyId: row.familyId, revokedAt: null } })).toBe(0);
  });

  test("reusing a rotated token after the grace window revokes the whole family", async () => {
    const { raw, row } = await refreshTokens.issue(user.id);
    const first = await refresh(raw);
    const rotated = cookieFrom(first);
    const past = new Date(Date.now() - refreshTokens.ROTATION_GRACE_MS - 1000);
    await RefreshTokens.update({ revokedAt: past }, { where: { tokenHash: refreshTokens.hash(raw) } });
    expect((await refresh(raw)).status).toBe(401);
    expect((await refresh(rotated)).status).toBe(401);
    const live = await RefreshTokens.count({ where: { familyId: row.familyId, revokedAt: null } });
    expect(live).toBe(0);
  });

  test("expired and missing tokens are rejected and the cookie cleared", async () => {
    const { raw, row } = await refreshTokens.issue(user.id);
    await row.update({ expiresAt: new Date(Date.now() - 1000) });
    const res = await refresh(raw);
    expect(res.status).toBe(401);
    expect([].concat(res.headers["set-cookie"]).join()).toMatch(new RegExp(`${COOKIE}=;`));
    expect((await refresh(null)).status).toBe(401);
    expect((await refresh("not-a-token")).status).toBe(401);
  });

  test("logout revokes the family even with no access token", async () => {
    const { raw } = await refreshTokens.issue(user.id);
    const out = await request(app, { method: "POST", path: "/api/auth/logout", cookie: `${COOKIE}=${raw}` });
    expect(out.status).toBe(200);
    expect((await refresh(raw)).status).toBe(401);
  });

  test("blocked users cannot refresh", async () => {
    const { school } = await makeSchool();
    const blocked = await makeUser(school.id, "teacher");
    const { raw } = await refreshTokens.issue(blocked.id);
    await blocked.update({ status: "block" });
    expect((await refresh(raw)).status).toBe(401);
  });
});
