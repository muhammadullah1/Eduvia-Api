"use strict";

const migration = require("../../database/migrations-archive/088-dedupe-application-documents");
const applicationService = require("../../services/application.service");
const { sequelize, Schools, Classes, AcademicSessions, ApplicationDocuments } = require("../../models");
const { REQUIRED_ADMISSION_DOCUMENTS } = require("../../constants/admissions");

const INDEX = "application_documents_application_title_unique";
const MEDICAL = "Medical / Vaccination Record";
const queryInterface = sequelize.getQueryInterface();

async function makeApplication(name) {
  const stamp = `${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
  const school = await Schools.create({ name: `Cleanup ${stamp}`, email: `cleanup-${stamp}@test.local`, code: `CL${stamp}`.slice(0, 20) });
  const session = await AcademicSessions.create({ fkSchoolId: school.id, name: "2026-27", startDate: "2026-04-01", endDate: "2027-03-31", isCurrent: true });
  const klass = await Classes.create({ fkSchoolId: school.id, fkSessionId: session.id, label: "Grade 2 · A", grade: "2", section: "A", capacity: 30 });
  return applicationService.createDraft(school.id, { name, fkClassId: klass.id });
}

/** Recreates the pre-fix state: no unique index, 3 copies of each document, plus Medical rows. */
async function seedDuplicates(applicationId) {
  await queryInterface.removeIndex("application_documents", INDEX);
  const copies = [...REQUIRED_ADMISSION_DOCUMENTS, MEDICAL, ...REQUIRED_ADMISSION_DOCUMENTS, MEDICAL];
  await ApplicationDocuments.bulkCreate(
    copies.map((title) => ({ fkApplicationId: applicationId, title, status: "Pending", documentType: "admission" })),
  );
}

describe("088 application document cleanup", () => {
  test("keeps the oldest row per document, removes copies and Medical, and restores the unique index", async () => {
    const app = await makeApplication("Duplicated Checklist");
    const originalIds = app.documents.map((d) => d.id).sort();
    await seedDuplicates(app.id);
    expect(await ApplicationDocuments.count({ where: { fkApplicationId: app.id } })).toBe(14);

    await migration.up(queryInterface);

    const rows = await ApplicationDocuments.findAll({ where: { fkApplicationId: app.id } });
    expect(rows.map((r) => r.title).sort()).toEqual([...REQUIRED_ADMISSION_DOCUMENTS].sort());
    expect(rows.map((r) => r.id).sort()).toEqual(originalIds);
    expect(rows.every((r) => r.status === "Pending")).toBe(true);
    const [indexes] = await sequelize.query(`SELECT indexname FROM pg_indexes WHERE indexname = '${INDEX}'`);
    expect(indexes).toHaveLength(1);
  });

  test("refuses to remove a row that holds a file and changes nothing", async () => {
    const app = await makeApplication("Copy With File");
    await seedDuplicates(app.id);
    const withFile = await ApplicationDocuments.create({
      fkApplicationId: app.id,
      title: "Guardian ID Copy (CNIC)",
      status: "Uploaded",
      fileUrl: "https://example.com/cnic.pdf",
      documentType: "admission",
    });
    const before = await ApplicationDocuments.count({ where: { fkApplicationId: app.id } });

    await expect(migration.up(queryInterface)).rejects.toThrow(new RegExp(`#${withFile.id}`));
    expect(await ApplicationDocuments.count({ where: { fkApplicationId: app.id } })).toBe(before);

    await withFile.destroy();
    await migration.up(queryInterface);
    expect(await ApplicationDocuments.count({ where: { fkApplicationId: app.id } })).toBe(REQUIRED_ADMISSION_DOCUMENTS.length);
  });
});
