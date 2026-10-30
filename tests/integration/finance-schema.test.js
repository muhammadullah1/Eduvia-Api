"use strict";

const {
  sequelize, FeeStructures, StudentCreditLedger, FeeImportBatches, FeeImportRows, OtherIncomes, Expenses, FeePayments,
} = require("../../models");
const { makeSchool, makeUser, makeClass, makeStudent } = require("../helpers/school");
const creditBackfill = require("../../database/migrations/060-student-credit-ledger").BACKFILL_SQL;
const creditService = require("../../services/credit_ledger.service");
const feeStructureService = require("../../services/fee_structure.service");
const { defaultPermissionsFor, isGrantable } = require("../../constants/permissions");

const can = (role, key) => defaultPermissionsFor(role).includes(key);
const otherIncomeValidation = require("../../validations/other_income");
const feeStructureValidation = require("../../validations/fee_structure");

let school, session, admin, klass, student;
let n = 0;
const uniq = () => `${Date.now()}${(n += 1)}`;

beforeAll(async () => {
  ({ school, session } = await makeSchool());
  admin = await makeUser(school.id, "super_admin");
  klass = await makeClass(school.id, session.id);
  await klass.update({ monthlyTuitionFee: 4500 });
  student = await makeStudent(school.id, klass.id);
});

afterAll(() => sequelize.close());

const expectDbError = (promise, re) => expect(promise).rejects.toThrow(re);
const actor = () => ({ id: admin.id, schoolId: school.id, role: "super_admin" });

describe("migration 059 fee_structures", () => {
  // The 059 backfill (class fee -> Tuition row) ran during migration up/down/up; its
  // ON CONFLICT target was replaced by 063's effective-date index, so it is not re-run here.
  test("fee structure view lists the four types and counts only monthly fees", async () => {
    const tuition = await FeeStructures.findOne({
      where: { fkClassId: klass.id, feeType: "Tuition" },
    });
    await tuition.update({ amount: 4500 });
    const view = await feeStructureService.forClass(school.id, klass.id, { asOf: "2026-05-01" });
    expect(view.fees.map((f) => f.feeType)).toEqual(["Tuition"]);
    expect(view.monthlyTotal).toBe(4500);
  });

  test("only one live row per class + fee type + effective date; archived rows do not block", async () => {
    const base = { fkSchoolId: school.id, fkSessionId: session.id, fkClassId: klass.id, feeType: "Admission", frequency: "OneTime", amount: 10000, effectiveFrom: "2026-04-01" };
    const first = await FeeStructures.create(base);
    await expectDbError(FeeStructures.create(base), /unique|Validation/i);
    await first.destroy();
    await expect(FeeStructures.create(base)).resolves.toBeTruthy();
    await expect(FeeStructures.create({ ...base, effectiveFrom: "2026-09-01" })).resolves.toBeTruthy();
    const view = await feeStructureService.forClass(school.id, klass.id, { asOf: "2026-05-01" });
    expect(view.monthlyTotal).toBe(4500); // one-time admission is kept out of the monthly total
  });

  test("DB rejects unknown fee types, frequencies and negative amounts", async () => {
    const q = (type, freq, amt) => sequelize.query(
      `INSERT INTO fee_structures (fk_school_id, fk_session_id, fk_class_id, fee_type, frequency, amount, effective_from, created_at, updated_at) VALUES (${school.id}, ${session.id}, ${klass.id}, '${type}', '${freq}', ${amt}, '2026-04-01', NOW(), NOW())`,
    );
    await expectDbError(q("Misc", "Monthly", 1), /fee_type_check/);
    await expectDbError(q("Exam", "Weekly", 1), /frequency_check/);
    await expectDbError(q("Annual", "Yearly", -5), /amount_check/);
  });
});

describe("migration 060 student_credit_ledger", () => {
  test("backfill creates one Credit per live payment with unallocated money, idempotently", async () => {
    const pay = (unallocated, extra = {}) => FeePayments.create({ fkSchoolId: school.id, fkStudentId: student.id, receiptNo: `R-${uniq()}`, amountPaid: 5000, unallocatedAmount: unallocated, paymentDate: "2026-10-01", ...extra });
    const withCredit = await pay(750);
    const none = await pay(0);
    const archived = await pay(300);
    await archived.destroy();
    await sequelize.query(creditBackfill);
    await sequelize.query(creditBackfill);
    const rows = await StudentCreditLedger.findAll({ where: { fkStudentId: student.id, source: "backfill" } });
    expect(rows.map((r) => r.fkPaymentId)).toEqual([withCredit.id]);
    expect(rows.map((r) => r.fkPaymentId)).not.toContain(none.id);
    expect(Number(rows[0].amount)).toBe(750);
    expect(await creditService.balance(school.id, student.id)).toBe(750);
  });

  test("credit can be applied but never taken below zero; amounts must be positive", async () => {
    const months = await sequelize.query(
      `INSERT INTO student_fee_months (fk_school_id, fk_student_id, month, fee_type, base_amount, discount_amount, net_amount, paid_amount, status, adjustment_total, collectible_amount, created_at, updated_at)
       VALUES (${school.id}, ${student.id}, '2026-11', 'Tuition', 4500, 0, 4500, 0, 'Unpaid', 0, 4500, NOW(), NOW()) RETURNING id`,
      { type: sequelize.QueryTypes.SELECT },
    );
    await creditService.applyCredit(actor(), { studentId: student.id, amount: 500, feeMonthId: months[0].id });
    expect(await creditService.balance(school.id, student.id)).toBe(250);
    await expect(creditService.applyCredit(actor(), { studentId: student.id, amount: 300, feeMonthId: months[0].id })).rejects.toThrow(/250.00 credit/);
    await expectDbError(
      sequelize.query(`INSERT INTO student_credit_ledger (fk_school_id, fk_student_id, entry_type, amount, source, created_at, updated_at) VALUES (${school.id}, ${student.id}, 'Credit', 0, 'manual', NOW(), NOW())`),
      /amount_check/,
    );
    await expectDbError(
      sequelize.query(`INSERT INTO student_credit_ledger (fk_school_id, fk_student_id, entry_type, amount, source, created_at, updated_at) VALUES (${school.id}, ${student.id}, 'Refund', 5, 'manual', NOW(), NOW())`),
      /entry_type_check/,
    );
  });
});

describe("migration 061 fee import history", () => {
  test("batch with rows; row numbers unique per batch; rows cascade with the batch", async () => {
    const batch = await FeeImportBatches.create({ fkSchoolId: school.id, fileName: "oct.xlsx", totalRows: 2, validRows: 1, errorRows: 1, fkUploadedByUserId: admin.id });
    await FeeImportRows.bulkCreate([
      { fkBatchId: batch.id, rowNumber: 1, admissionNo: student.admissionNo, fkStudentId: student.id, month: "2026-10", amount: 4500, status: "Valid" },
      { fkBatchId: batch.id, rowNumber: 2, admissionNo: "NOPE", status: "Error", errors: ["Student not found"] },
    ]);
    const loaded = await FeeImportBatches.findByPk(batch.id, { include: [{ model: FeeImportRows, as: "rows" }] });
    expect(loaded.status).toBe("Validated");
    expect(loaded.rows).toHaveLength(2);
    await expectDbError(FeeImportRows.create({ fkBatchId: batch.id, rowNumber: 1, status: "Valid" }), /unique|Validation/i);
    await expectDbError(sequelize.query(`UPDATE fee_import_batches SET status = 'Weird' WHERE id = ${batch.id}`), /status_check/);
    await sequelize.query(`DELETE FROM fee_import_batches WHERE id = ${batch.id}`);
    expect(await FeeImportRows.count({ where: { fkBatchId: batch.id } })).toBe(0);
  });
});

describe("migration 062 other income, expense payment method, DECIMAL(12,2)", () => {
  test("other income stores large amounts and rejects bad method / zero", async () => {
    const row = await OtherIncomes.create({ fkSchoolId: school.id, title: "Canteen lease", category: "Rent", categoryKey: "Misc", amount: 1234567890.12, incomeDate: "2026-10-05", paymentMethod: "BankTransfer", fkRecordedByUserId: admin.id });
    expect(Number((await OtherIncomes.findByPk(row.id)).amount)).toBe(1234567890.12);
    await expectDbError(
      sequelize.query(`INSERT INTO other_incomes (fk_school_id, title, category, category_key, amount, income_date, payment_method, created_at, updated_at) VALUES (${school.id}, 'x', 'Other', 'Misc', 10, '2026-10-01', 'Crypto', NOW(), NOW())`),
      /payment_method_check/,
    );
    await expectDbError(
      sequelize.query(`INSERT INTO other_incomes (fk_school_id, title, category, category_key, amount, income_date, created_at, updated_at) VALUES (${school.id}, 'x', 'Other', 'Misc', 0, '2026-10-01', NOW(), NOW())`),
      /amount_check/,
    );
  });

  test("expenses keep working without a payment method and accept a valid one", async () => {
    const legacy = await Expenses.create({ fkSchoolId: school.id, title: "Chalk", category: "Stationery", categoryKey: "Supplies", amount: 250, date: "2026-10-02" });
    expect(legacy.paymentMethod ?? null).toBeNull();
    const big = await Expenses.create({ fkSchoolId: school.id, title: "Building", category: "Maintenance", categoryKey: "Maintenance", amount: 150000000, date: "2026-10-02", paymentMethod: "Cheque" });
    expect(Number((await Expenses.findByPk(big.id)).amount)).toBe(150000000);
    await expectDbError(sequelize.query(`UPDATE expenses SET payment_method = 'Barter' WHERE id = ${big.id}`), /payment_method_check/);
  });

  test("all fee money columns are NUMERIC(12,2)", async () => {
    const rows = await sequelize.query(
      `SELECT table_name || '.' || column_name AS col, numeric_precision AS p, numeric_scale AS s FROM information_schema.columns
       WHERE table_schema = 'public' AND (table_name, column_name) IN (('classes','monthly_tuition_fee'),('students','fixed_monthly_fee'),('expenses','amount'),
         ('fee_payments','amount_paid'),('fee_payments','unallocated_amount'),('fee_allocations','allocated_amount'),('student_fee_months','base_amount'),
         ('student_fee_months','discount_amount'),('student_fee_months','net_amount'),('student_fee_months','paid_amount'))`,
      { type: sequelize.QueryTypes.SELECT },
    );
    expect(rows).toHaveLength(10);
    for (const r of rows) expect([r.col, r.p, r.s]).toEqual([r.col, 12, 2]);
  });
});

describe("finance permissions and validation scaffolding", () => {
  test("Ops and Teachers get no finance capability; accountant reads structure but cannot edit", () => {
    for (const perm of ["fees.structure.read", "fees.structure.update", "fees.credit.read", "fees.import", "income.read", "income.create", "income.manage"]) {
      expect(can("operations_manager", perm)).toBe(false);
      expect(can("teacher", perm)).toBe(false);
      expect(isGrantable("operations_manager", perm)).toBe(false);
      expect(isGrantable("teacher", perm)).toBe(false);
    }
    expect(can("accountant", "fees.structure.read")).toBe(true);
    expect(can("accountant", "fees.structure.update")).toBe(false);
    expect(can("accountant", "fees.import")).toBe(true);
  });

  test("validators accept the four fee types only and known income categories", () => {
    const body = feeStructureValidation.validateAdd.body;
    expect(body.validate({ feeType: "Exam", amount: 1500, effectiveFrom: "2026-04-01" }).error).toBeUndefined();
    expect(body.validate({ feeType: "Misc", amount: 1, effectiveFrom: "2026-04-01" }).error).toBeDefined();
    const income = otherIncomeValidation.validateCreate.body;
    expect(income.validate({ description: "Alumni donation", category: "Donation", amount: 100, date: "2026-10-01" }).error).toBeUndefined();
    // Step 8: other income is Donation / Grant / Misc only (Figma); Rent etc. map to Misc.
    expect(income.validate({ description: "Lease", category: "Rent", amount: 100, date: "2026-10-01" }).error).toBeDefined();
    expect(income.validate({ description: "Lease", category: "Lottery", amount: 100, date: "2026-10-01" }).error).toBeDefined();
  });
});
