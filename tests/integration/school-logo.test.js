"use strict";

/** School logo: Super Admin only, own school's folder, JPEG only; the old object is removed on change. */
const crypto = require("crypto");
const app = require("../../app");
const { sequelize } = require("../../models");
const storageService = require("../../services/storage.service");
const { assertCanUpload } = require("../../services/upload_policy.service");
const { actorFor, makeSchool, makeUser, tokenFor } = require("../helpers/school");
const { request } = require("../helpers/http");

const patch = (token, body) => request(app, { method: "PATCH", path: "/api/schools/current", token, body });
const jpeg = () => `${crypto.randomUUID()}.jpg`;

describe("school logo", () => {
  let school;
  let admin;
  let ops;
  let other;

  beforeAll(async () => {
    ({ school } = await makeSchool());
    admin = await makeUser(school.id, "super_admin");
    ops = await makeUser(school.id, "operations_manager");
    other = (await makeSchool()).school;
    jest.spyOn(storageService, "deleteObject").mockResolvedValue(true);
    jest.spyOn(storageService, "storageConfig").mockReturnValue(null);
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    await sequelize.close();
  });

  test("only a Super Admin may upload a JPEG into their own school's logo folder", async () => {
    const dirName = `school-logos/${school.id}`;
    await expect(assertCanUpload(await actorFor(admin), { dirName, fileName: jpeg(), contentType: "image/jpeg" })).resolves.toBeUndefined();
    await expect(assertCanUpload(await actorFor(ops), { dirName, fileName: jpeg(), contentType: "image/jpeg" })).rejects.toMatchObject({ statusCode: 403 });
    await expect(assertCanUpload(await actorFor(admin), { dirName: `school-logos/${other.id}`, fileName: jpeg(), contentType: "image/jpeg" })).rejects.toMatchObject({ statusCode: 403 });
    await expect(assertCanUpload(await actorFor(admin), { dirName, fileName: `${crypto.randomUUID()}.png`, contentType: "image/png" })).rejects.toMatchObject({ statusCode: 400 });
  });

  test("the profile stores only a key from this school's folder, replaces and removes it", async () => {
    const tok = tokenFor(admin);
    expect((await patch(tok, { logo: `school-logos/${other.id}/${jpeg()}` })).status).toBe(400);
    expect((await patch(tok, { logo: "https://example.com/logo.jpg" })).status).toBe(400);
    expect((await patch(tokenFor(ops), { logo: `school-logos/${school.id}/${jpeg()}` })).status).toBe(403);
    const first = `school-logos/${school.id}/${jpeg()}`;
    const res = await patch(tok, { logo: first });
    expect(res.status).toBe(200);
    expect(res.body.data.logo).toBe(first);
    expect(res.body.data).toHaveProperty("logoUrl");
    const second = `school-logos/${school.id}/${jpeg()}`;
    expect((await patch(tok, { logo: second })).status).toBe(200);
    expect(storageService.deleteObject).toHaveBeenCalledWith(first);
    const cleared = await patch(tok, { logo: null });
    expect(cleared.body.data.logo).toBeNull();
    expect(storageService.deleteObject).toHaveBeenCalledWith(second);
  });
});
