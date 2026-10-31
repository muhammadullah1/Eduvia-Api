"use strict";

const app = require("../../app");
const { sequelize, SchoolSettings, AuditLogs } = require("../../models");
const { SETTING_KEYS } = require("../../constants");
const { makeSchool, makeUser, tokenFor } = require("../helpers/school");
const { request } = require("../helpers/http");

const call = (token, method, path, body) =>
  request(app, { method, path: `/api${path}`, token, body });

describe("Settings API integration", () => {
  let school;
  let tok;

  beforeAll(async () => {
    await sequelize.authenticate();
    ({ school } = await makeSchool());
    const users = {
      admin: await makeUser(school.id, "super_admin"),
      ops: await makeUser(school.id, "operations_manager"),
      acc: await makeUser(school.id, "accountant"),
      teacher: await makeUser(school.id, "teacher"),
    };
    tok = Object.fromEntries(
      Object.entries(users).map(([k, u]) => [k, tokenFor(u)])
    );
  });

  describe("GET /api/settings", () => {
    it("allows Super Admin to view all 5 setting groups", async () => {
      const res = await call(tok.admin, "GET", "/settings");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const settings = res.body.data;
      expect(settings).toHaveProperty("dailyTestRules");
      expect(settings).toHaveProperty("resultVisibility");
      expect(settings).toHaveProperty("fees");
      expect(settings).toHaveProperty("attendance");
      expect(settings).toHaveProperty("admission");

      expect(settings.fees.defaultMonthlyFee).toBeUndefined();
      expect(settings.fees.dueDay).toBeDefined();
      expect(settings.attendance.editWindowDays).toBeDefined();
      expect(settings.admission.prefix).toBeDefined();
    });

    it("allows Operations Manager to read settings", async () => {
      const res = await call(tok.ops, "GET", "/settings");
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty("dailyTestRules");
      expect(res.body.data).toHaveProperty("fees");
    });

    it("refuses Accountant and Teacher with 403", async () => {
      expect((await call(tok.acc, "GET", "/settings")).status).toBe(403);
      expect((await call(tok.teacher, "GET", "/settings")).status).toBe(403);
    });

    it("refuses unauthenticated request with 401", async () => {
      expect((await call(null, "GET", "/settings")).status).toBe(401);
    });
  });

  describe("Role-based write authorization", () => {
    it("allows Super Admin to update fees and resultVisibility", async () => {
      const feeRes = await call(tok.admin, "PUT", "/settings/fees", {
        dueDay: 15,
        maxAdvanceMonths: 6,
        concessionPolicy: {
          allowedModes: ["percent", "fixed_discount", "waiver"],
          approvalRule: "always",
          approvalPercentAbove: null,
          approvalAmountAbove: null,
        },
      });
      expect(feeRes.status).toBe(200);
      expect(feeRes.body.data.defaultMonthlyFee).toBeUndefined();
      expect(feeRes.body.data.concessionsEnabled).toBeUndefined();
      expect(feeRes.body.data.dueDay).toBe(15);
      expect(feeRes.body.data.maxAdvanceMonths).toBe(6);
      expect(feeRes.body.data.concessionPolicy.approvalRule).toBe("always");

      const resRes = await call(tok.admin, "PUT", "/settings/resultVisibility", {
        feeRule: "disabled",
        rankTie: "dense",
      });
      expect(resRes.status).toBe(200);
      expect(resRes.body.data.feeRule).toBe("disabled");
      expect(resRes.body.data.rankTie).toBe("dense");
    });

    it("refuses Operations Manager from updating fees (403)", async () => {
      const res = await call(tok.ops, "PUT", "/settings/fees", {
        dueDay: 12,
      });
      expect(res.status).toBe(403);
    });

    it("refuses Operations Manager from updating resultVisibility (403)", async () => {
      const res = await call(tok.ops, "PUT", "/settings/resultVisibility", {
        feeRule: "disabled",
      });
      expect(res.status).toBe(403);
    });

    it("allows Operations Manager to update academic settings: dailyTestRules, attendance, admission", async () => {
      const testRes = await call(tok.ops, "PUT", "/settings/dailyTestRules", {
        passPercent: 45,
        maxFailsPerMonth: 2,
      });
      expect(testRes.status).toBe(200);
      expect(testRes.body.data.passPercent).toBe(45);
      expect(testRes.body.data.maxFailsPerMonth).toBe(2);

      const attRes = await call(tok.ops, "PUT", "/settings/attendance", {
        editWindowDays: 14,
        lowThreshold: 80,
      });
      expect(attRes.status).toBe(200);
      expect(attRes.body.data.editWindowDays).toBe(14);
      expect(attRes.body.data.lowThreshold).toBe(80);

      const admRes = await call(tok.ops, "PUT", "/settings/admission", {
        prefix: "TEST",
        digits: 5,
      });
      expect(admRes.status).toBe(200);
      expect(admRes.body.data.prefix).toBe("TEST");
      expect(admRes.body.data.digits).toBe(5);
    });

    it("refuses Accountant and Teacher from any PUT /api/settings/:key (403)", async () => {
      expect((await call(tok.acc, "PUT", "/settings/fees", { dueDay: 5 })).status).toBe(403);
      expect((await call(tok.teacher, "PUT", "/settings/dailyTestRules", { passPercent: 50 })).status).toBe(403);
    });
  });

  describe("Key aliases normalization", () => {
    it("accepts daily-tests and daily-test-rules as aliases for dailyTestRules", async () => {
      const res1 = await call(tok.admin, "PUT", "/settings/daily-tests", {
        passPercent: 50,
      });
      expect(res1.status).toBe(200);
      expect(res1.body.data.passPercent).toBe(50);

      const res2 = await call(tok.admin, "PUT", "/settings/daily-test-rules", {
        passPercent: 52,
      });
      expect(res2.status).toBe(200);
      expect(res2.body.data.passPercent).toBe(52);
    });

    it("accepts results and result-visibility as aliases for resultVisibility", async () => {
      const res1 = await call(tok.admin, "PUT", "/settings/results", {
        feeRule: "exam_month_paid",
      });
      expect(res1.status).toBe(200);
      expect(res1.body.data.feeRule).toBe("exam_month_paid");

      const res2 = await call(tok.admin, "PUT", "/settings/result-visibility", {
        rankTie: "shared",
      });
      expect(res2.status).toBe(200);
      expect(res2.body.data.rankTie).toBe("shared");
    });
  });

  describe("Validation constraints", () => {
    it("rejects invalid fees values (dueDay > 28, advance > 24) and strips school-wide tuition", async () => {
      const r1 = await call(tok.admin, "PUT", "/settings/fees", { dueDay: 29 });
      expect(r1.status).toBe(400);

      const r2 = await call(tok.admin, "PUT", "/settings/fees", { dueDay: 0 });
      expect(r2.status).toBe(400);

      const r3 = await call(tok.admin, "PUT", "/settings/fees", {
        dueDay: 10,
        defaultMonthlyFee: 9000,
      });
      expect(r3.status).toBe(200);
      expect(r3.body.data.defaultMonthlyFee).toBeUndefined();

      const r4 = await call(tok.admin, "PUT", "/settings/fees", { maxAdvanceMonths: 25 });
      expect(r4.status).toBe(400);
    });

    it("rejects invalid attendance values (editWindowDays > 31 or < 0, lowThreshold > 100)", async () => {
      const r1 = await call(tok.ops, "PUT", "/settings/attendance", { editWindowDays: 32 });
      expect(r1.status).toBe(400);

      const r2 = await call(tok.ops, "PUT", "/settings/attendance", { editWindowDays: -1 });
      expect(r2.status).toBe(400);

      const r3 = await call(tok.ops, "PUT", "/settings/attendance", { lowThreshold: 101 });
      expect(r3.status).toBe(400);
    });

    it("rejects invalid admission digits (> 8 or < 1)", async () => {
      const r1 = await call(tok.ops, "PUT", "/settings/admission", { digits: 9 });
      expect(r1.status).toBe(400);

      const r2 = await call(tok.ops, "PUT", "/settings/admission", { digits: 0 });
      expect(r2.status).toBe(400);
    });

    it("rejects unknown setting key (400)", async () => {
      const res = await call(tok.admin, "PUT", "/settings/unknownKey", { foo: "bar" });
      expect(res.status).toBe(400);
    });
  });

  describe("Database persistence & audit trail", () => {
    it("persists updates to school_settings table and writes audit log", async () => {
      await call(tok.admin, "PUT", "/settings/fees", {
        dueDay: 18,
      });

      const row = await SchoolSettings.findOne({
        where: { fkSchoolId: school.id, key: SETTING_KEYS.FEES },
      });
      expect(row).not.toBeNull();
      expect(row.value.dueDay).toBe(18);

      const audit = await AuditLogs.findOne({
        where: {
          fkSchoolId: school.id,
          entityType: "school_setting",
          entityId: row.id,
        },
        order: [[sequelize.literal("created_at"), "DESC"]],
      });
      expect(audit).not.toBeNull();
      expect(audit.action).toMatch(/updated setting fees/);

      const getRes = await call(tok.admin, "GET", "/settings");
      expect(getRes.body.data.fees.dueDay).toBe(18);
    });
  });

  describe("grading scale and receipt template", () => {
    const bands = [
      { min: 85, grade: "A" },
      { min: 65, grade: "B" },
      { min: 0, grade: "C" },
    ];

    it("saves a custom grading scale that exams then use", async () => {
      const res = await call(tok.admin, "PUT", "/settings/grading", { bands });
      expect(res.status).toBe(200);
      const examService = require("../../services/exam.service");
      const saved = (await call(tok.admin, "GET", "/settings")).body.data.grading.bands;
      expect(examService.gradeFor(70, true, saved)).toBe("B");
      expect(examService.gradeFor(70, false, saved)).toBe("F");
    });

    it("rejects a scale without a 0% band, duplicate grades, or the fail grade", async () => {
      expect((await call(tok.admin, "PUT", "/settings/grading", { bands: [{ min: 50, grade: "A" }, { min: 40, grade: "B" }] })).status).toBe(400);
      expect((await call(tok.admin, "PUT", "/settings/grading", { bands: [{ min: 50, grade: "A" }, { min: 0, grade: "a" }] })).status).toBe(400);
      expect((await call(tok.admin, "PUT", "/settings/grading", { bands: [{ min: 50, grade: "A" }, { min: 0, grade: "F" }] })).status).toBe(400);
    });

    it("keeps the grading scale for academic editors and the receipt for fee editors", async () => {
      expect((await call(tok.teacher, "PUT", "/settings/grading", { bands })).status).toBe(403);
      expect((await call(tok.teacher, "PUT", "/settings/receipt", { footerNote: "x" })).status).toBe(403);
    });

    it("saves the receipt template and validates its length", async () => {
      const res = await call(tok.admin, "PUT", "/settings/receipt", { footerNote: "Fees once paid are not refundable.", showSignatureLine: false });
      expect(res.status).toBe(200);
      const all = (await call(tok.admin, "GET", "/settings")).body.data;
      expect(all.receipt).toEqual({ footerNote: "Fees once paid are not refundable.", showSignatureLine: false });
      expect((await call(tok.admin, "PUT", "/settings/receipt", { footerNote: "x".repeat(301) })).status).toBe(400);
    });
  });

  describe("school profile", () => {
    it("lets the Super Admin edit the profile, audits it and refuses bad values", async () => {
      const res = await call(tok.admin, "PATCH", "/schools/current", { name: "Renamed School", phone: "+92 300 1234567", website: "https://example.edu.pk" });
      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe("Renamed School");
      const audit = await AuditLogs.findOne({ where: { fkSchoolId: school.id, entityType: "school" }, order: [["id", "DESC"]] });
      expect(audit.metadata.after.name).toBe("Renamed School");
      expect((await call(tok.admin, "PATCH", "/schools/current", { website: "example" })).status).toBe(400);
      expect((await call(tok.admin, "PATCH", "/schools/current", { phone: "call me" })).status).toBe(400);
      expect((await call(tok.admin, "PATCH", "/schools/current", { name: "X" })).status).toBe(400);
      const other = await makeSchool();
      expect((await call(tok.admin, "PATCH", "/schools/current", { email: other.school.email })).status).toBe(409);
    });

    it("refuses roles without school.update", async () => {
      expect((await call(tok.acc, "PATCH", "/schools/current", { name: "Nope School" })).status).toBe(403);
      expect((await call(tok.teacher, "PATCH", "/schools/current", { name: "Nope School" })).status).toBe(403);
    });
  });
});
