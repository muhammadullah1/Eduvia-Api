"use strict";

// Signing is local (no network), so placeholder credentials work in tests.
const config = require("../../config");

config.set("cloudFareR2.endpoint", "https://account.r2.cloudflarestorage.com");
config.set("cloudFareR2.accessKeyId", "test-key");
config.set("cloudFareR2.secretAccessKey", "test-secret");
config.set("cloudFareR2.bucket", "test-bucket");

const crypto = require("crypto");
const app = require("../../app");
const { sequelize, ApplicationDocuments } = require("../../models");
const applicationService = require("../../services/application.service");
const storageService = require("../../services/storage.service");
const { request } = require("../helpers/http");
const { makeSchool, makeUser, tokenFor, makeClass, makeStudent, makeParent } = require("../helpers/school");

async function fixture() {
  const { school, session } = await makeSchool();
  const klass = await makeClass(school.id, session.id);
  const admin = await makeUser(school.id, "super_admin");
  const teacher = await makeUser(school.id, "teacher");
  const child = await makeStudent(school.id, klass.id);
  const parent = await makeParent(school.id, child.id);
  const otherParent = await makeParent(school.id, (await makeStudent(school.id, klass.id)).id);
  const draft = await applicationService.createDraft(school.id, { name: "Kid Test", fkClassId: klass.id });
  await draft.update({ enrolledStudentId: child.id });
  const doc = await ApplicationDocuments.findOne({ where: { fkApplicationId: draft.id } });
  const key = `admissions/${draft.id}/documents/${crypto.randomUUID()}.pdf`;
  await doc.update({ status: "Uploaded", fileUrl: key });
  return { school, admin, teacher, parent, otherParent, draft, doc, key };
}

describe("file storage and document access", () => {
  beforeAll(() => sequelize.authenticate());

  test("presigned upload: auth required, folder/type/name checked, key is dirName/fileName", async () => {
    const fx = await fixture();
    const fileName = `${crypto.randomUUID()}.pdf`;
    const body = { dirName: `/admissions/${fx.draft.id}/documents/`, fileName, contentType: "application/pdf" };
    const path = "/api/auth/get-presigned-url";

    expect((await request(app, { method: "POST", path, body })).status).toBe(401);

    const ok = await request(app, { method: "POST", path, body, token: tokenFor(fx.admin) });
    expect(ok.status).toBe(200);
    expect(ok.body.data).toMatchObject({
      objectKey: `admissions/${fx.draft.id}/documents/${fileName}`,
      contentType: "application/pdf",
      expiresIn: 300,
    });
    expect(ok.body.data.uploadUrl).toContain("X-Amz-Signature");
    expect(Object.keys(ok.body.data).sort()).toEqual(["bucket", "contentType", "expiresIn", "fileUrl", "objectKey", "uploadUrl"]);

    const teacher = await request(app, { method: "POST", path, body, token: tokenFor(fx.teacher) });
    expect(teacher.status).toBe(403);
    const badDir = await request(app, { method: "POST", path, body: { ...body, dirName: "anything" }, token: tokenFor(fx.admin) });
    expect(badDir.status).toBe(400);
    const badName = await request(app, { method: "POST", path, body: { ...body, fileName: "report.pdf" }, token: tokenFor(fx.admin) });
    expect(badName.status).toBe(400);
    const badType = await request(app, { method: "POST", path, body: { ...body, contentType: "text/html" }, token: tokenFor(fx.admin) });
    expect(badType.status).toBe(400);
    const tooLong = await request(app, { method: "POST", path, body: { ...body, dirName: "a".repeat(101) }, token: tokenFor(fx.admin) });
    expect(tooLong.status).toBe(400);
  });

  test("document link: 401 without token, 403 for teacher and another parent, 200 for admin and own parent", async () => {
    const fx = await fixture();
    const path = `/api/applications/${fx.draft.id}/documents/${fx.doc.id}/url`;
    expect((await request(app, { path })).status).toBe(401);
    expect((await request(app, { path, token: tokenFor(fx.teacher) })).status).toBe(403);
    expect((await request(app, { path, token: tokenFor(fx.otherParent) })).status).toBe(403);

    for (const user of [fx.admin, fx.parent]) {
      const res = await request(app, { path, token: tokenFor(user) });
      expect(res.status).toBe(200);
      expect(res.body.data.expiresIn).toBe(300);
      expect(res.body.data.url).toContain(fx.key);
      expect(res.body.data.url).toContain("X-Amz-Expires=300");
    }
  });

  test("a document can't be pointed at another application's file", async () => {
    const fx = await fixture();
    const foreign = `admissions/${fx.draft.id + 1000}/documents/${crypto.randomUUID()}.pdf`;
    await expect(
      applicationService.update(fx.draft.id, fx.school.id, {
        documents: [{ id: fx.doc.id, label: "Birth certificate", status: "Uploaded", fileUrl: foreign }],
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  test("another school's admin gets 404", async () => {
    const fx = await fixture();
    const { school } = await makeSchool();
    const stranger = await makeUser(school.id, "super_admin");
    const res = await request(app, { path: `/api/applications/${fx.draft.id}/documents/${fx.doc.id}/url`, token: tokenFor(stranger) });
    expect(res.status).toBe(404);
  });

  test("503 when storage is not configured", async () => {
    const spy = jest.spyOn(storageService, "storageConfig").mockReturnValue(null);
    await expect(storageService.presignUpload({ dirName: "avatars", fileName: "x.png", contentType: "image/png" })).rejects.toMatchObject({
      statusCode: 503,
    });
    spy.mockRestore();
  });
});
