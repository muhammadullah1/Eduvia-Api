"use strict";

/** The admission checklist over HTTP: served from one source, retired/duplicate labels refused. */
const app = require("../../app");
const { sequelize, ApplicationDocuments } = require("../../models");
const { REQUIRED_ADMISSION_DOCUMENTS } = require("../../constants/admissions");
const { makeSchool, makeUser, tokenFor, makeClass } = require("../helpers/school");
const { request } = require("../helpers/http");

describe("admission document checklist API", () => {
  let token;
  let teacherToken;
  let klass;

  beforeAll(async () => {
    const { school, session } = await makeSchool();
    klass = await makeClass(school.id, session.id);
    token = tokenFor(await makeUser(school.id, "super_admin"));
    teacherToken = tokenFor(await makeUser(school.id, "teacher"));
  });

  afterAll(() => sequelize.close());

  test("serves the 4 required documents, all Pending", async () => {
    const res = await request(app, { path: "/api/applications/document-checklist", token });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(REQUIRED_ADMISSION_DOCUMENTS.map((label) => ({ label, status: "Pending" })));
    expect((await request(app, { path: "/api/applications/document-checklist", token: teacherToken })).status).toBe(403);
  });

  test("a draft gets exactly the 4; Medical and repeated labels are refused", async () => {
    const draft = await request(app, { method: "POST", path: "/api/applications/drafts", token, body: { name: "Http Draft", fkClassId: klass.id } });
    expect(draft.status).toBe(201);
    expect(draft.body.data.documents).toHaveLength(REQUIRED_ADMISSION_DOCUMENTS.length);
    const id = draft.body.data.id;
    const medical = await request(app, {
      method: "PATCH",
      path: `/api/applications/${id}`,
      token,
      body: { documents: [{ label: "Medical / Vaccination Record", status: "Pending" }] },
    });
    expect(medical.status).toBe(400);
    const twice = await request(app, {
      method: "PATCH",
      path: `/api/applications/${id}`,
      token,
      body: { documents: [{ label: "Guardian ID Copy (CNIC)" }, { label: "Guardian ID Copy (CNIC)" }] },
    });
    expect(twice.status).toBe(400);
    expect(await ApplicationDocuments.count({ where: { fkApplicationId: id } })).toBe(REQUIRED_ADMISSION_DOCUMENTS.length);
  });
});
