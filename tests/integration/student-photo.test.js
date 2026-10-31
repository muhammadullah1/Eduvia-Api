"use strict";

/** Student photo: students.manage only, the student's own folder, JPEG/PNG; replacing or clearing removes the old file. */
const crypto = require("crypto");
const app = require("../../app");
const { sequelize, Students } = require("../../models");
const storageService = require("../../services/storage.service");
const { assertCanUpload, MAX_IMAGE_BYTES } = require("../../services/upload_policy.service");
const { actorFor, makeSchool, makeUser, tokenFor, makeClass, makeStudent } = require("../helpers/school");
const { request } = require("../helpers/http");

const put = (token, id, body) => request(app, { method: "PUT", path: `/api/students/${id}/photo`, token, body });
const get = (token, id) => request(app, { path: `/api/students/${id}`, token });
const file = (ext) => `${crypto.randomUUID()}.${ext}`;

describe("student photo", () => {
  let school;
  let student;
  let otherStudent;
  let admin;
  let ops;
  let teacher;
  let accountant;

  beforeAll(async () => {
    const made = await makeSchool();
    school = made.school;
    const klass = await makeClass(school.id, made.session.id);
    student = await makeStudent(school.id, klass.id);
    const other = await makeSchool();
    otherStudent = await makeStudent(other.school.id, (await makeClass(other.school.id, other.session.id)).id);
    admin = await makeUser(school.id, "super_admin");
    ops = await makeUser(school.id, "operations_manager");
    teacher = await makeUser(school.id, "teacher");
    accountant = await makeUser(school.id, "accountant");
    jest.spyOn(storageService, "deleteObject").mockResolvedValue(true);
    jest.spyOn(storageService, "storageConfig").mockReturnValue({ bucket: "test" });
    jest.spyOn(storageService, "objectInfo").mockResolvedValue({ size: 50000, contentType: "image/jpeg" });
    jest.spyOn(storageService, "signedDownloadUrl").mockImplementation(async (key) => ({ url: `https://signed.test/${key}` }));
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    await sequelize.close();
  });

  test("upload signing: managers only, own school's students, JPEG or PNG", async () => {
    const dirName = `students/${student.id}/photos`;
    for (const user of [admin, ops]) {
      await expect(assertCanUpload(await actorFor(user), { dirName, fileName: file("jpg"), contentType: "image/jpeg" })).resolves.toBeUndefined();
    }
    await expect(assertCanUpload(await actorFor(admin), { dirName, fileName: file("png"), contentType: "image/png" })).resolves.toBeUndefined();
    for (const user of [teacher, accountant]) {
      await expect(assertCanUpload(await actorFor(user), { dirName, fileName: file("jpg"), contentType: "image/jpeg" })).rejects.toMatchObject({ statusCode: 403 });
    }
    await expect(assertCanUpload(await actorFor(admin), { dirName, fileName: file("pdf"), contentType: "application/pdf" })).rejects.toMatchObject({ statusCode: 400 });
    await expect(
      assertCanUpload(await actorFor(admin), { dirName, fileName: file("jpg"), contentType: "image/jpeg", contentLength: MAX_IMAGE_BYTES + 1 }),
    ).rejects.toMatchObject({ statusCode: 400 });
    await expect(
      assertCanUpload(await actorFor(admin), { dirName, fileName: file("jpg"), contentType: "image/jpeg", contentLength: MAX_IMAGE_BYTES }),
    ).resolves.toBeUndefined();
    await expect(assertCanUpload(await actorFor(admin), { dirName, fileName: "../evil.jpg", contentType: "image/jpeg" })).rejects.toMatchObject({ statusCode: 400 });
    await expect(
      assertCanUpload(await actorFor(admin), { dirName: `students/${otherStudent.id}/photos`, fileName: file("jpg"), contentType: "image/jpeg" }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  test("saves, returns a signed link, replaces (deleting the old file) and clears", async () => {
    const tok = tokenFor(admin);
    const first = `students/${student.id}/photos/${file("jpg")}`;
    const saved = await put(tok, student.id, { photo: first });
    expect(saved.status).toBe(200);
    expect(saved.body.data).toMatchObject({ photo: first, photoUrl: `https://signed.test/${first}` });

    const reread = await get(tok, student.id);
    expect(reread.body.data).toMatchObject({ photo: first, photoUrl: `https://signed.test/${first}` });

    const second = `students/${student.id}/photos/${file("png")}`;
    expect((await put(tokenFor(ops), student.id, { photo: second })).status).toBe(200);
    expect(storageService.deleteObject).toHaveBeenCalledWith(first);
    expect((await Students.findByPk(student.id)).photo).toBe(second);

    const cleared = await put(tok, student.id, { photo: null });
    expect(cleared.body.data).toMatchObject({ photo: null, photoUrl: null });
    expect(storageService.deleteObject).toHaveBeenCalledWith(second);
  });

  test("refuses an upload that is missing, too large or not an image, and deletes the bad file", async () => {
    const tok = tokenFor(admin);
    const key = () => `students/${student.id}/photos/${file("jpg")}`;
    storageService.objectInfo.mockResolvedValueOnce(null);
    expect((await put(tok, student.id, { photo: key() })).status).toBe(400);
    const big = key();
    storageService.objectInfo.mockResolvedValueOnce({ size: MAX_IMAGE_BYTES + 1, contentType: "image/jpeg" });
    expect((await put(tok, student.id, { photo: big })).status).toBe(400);
    expect(storageService.deleteObject).toHaveBeenCalledWith(big);
    const html = key();
    storageService.objectInfo.mockResolvedValueOnce({ size: 10, contentType: "text/html" });
    expect((await put(tok, student.id, { photo: html })).status).toBe(400);
    expect(storageService.deleteObject).toHaveBeenCalledWith(html);
  });

  test("archiving (deleting) a student keeps the photo so a restore brings it back", async () => {
    const made = await makeSchool();
    const pending = await makeStudent(made.school.id, (await makeClass(made.school.id, made.session.id)).id, { status: "Pending" });
    const sa = await makeUser(made.school.id, "super_admin");
    const key = `students/${pending.id}/photos/${file("jpg")}`;
    expect((await put(tokenFor(sa), pending.id, { photo: key })).status).toBe(200);
    storageService.deleteObject.mockClear();
    const removed = await request(app, { method: "DELETE", path: `/api/students/${pending.id}`, token: tokenFor(sa) });
    expect(removed.status).toBe(200);
    expect(storageService.deleteObject).not.toHaveBeenCalled();
    expect((await Students.findByPk(pending.id, { paranoid: false })).photo).toBe(key);
  });

  test("rejects keys outside the student's folder, other schools and roles without students.manage", async () => {
    const tok = tokenFor(admin);
    expect((await put(tok, student.id, { photo: `students/${otherStudent.id}/photos/${file("jpg")}` })).status).toBe(400);
    expect((await put(tok, student.id, { photo: `avatars/${file("jpg")}` })).status).toBe(400);
    expect((await put(tok, student.id, { photo: `students/${student.id}/photos/${file("gif")}` })).status).toBe(400);
    expect((await put(tok, student.id, { photo: "https://example.com/me.jpg" })).status).toBe(400);
    expect((await put(tok, student.id, {})).status).toBe(400);
    expect((await put(tok, otherStudent.id, { photo: `students/${otherStudent.id}/photos/${file("jpg")}` })).status).toBe(404);
    expect((await put(tokenFor(teacher), student.id, { photo: `students/${student.id}/photos/${file("jpg")}` })).status).toBe(403);
    expect((await put(tokenFor(accountant), student.id, { photo: `students/${student.id}/photos/${file("jpg")}` })).status).toBe(403);
  });
});
