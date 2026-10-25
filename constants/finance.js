"use strict";

/** Finance reference lists (Step 2). Mirrored by the DB CHECK constraints in migrations 059-062. */
exports.FEE_TYPES = ["Tuition", "Admission", "Exam", "Annual"];
exports.FEE_FREQUENCIES = ["Monthly", "OneTime", "Yearly"];
/** Default frequency per fee type: tuition is monthly, the others are kept out of the monthly total. */
exports.FEE_TYPE_FREQUENCY = { Tuition: "Monthly", Admission: "OneTime", Exam: "Yearly", Annual: "Yearly" };
exports.PAYMENT_METHODS = ["Cash", "BankTransfer", "Cheque", "Online"];
exports.CREDIT_ENTRY_TYPES = ["Credit", "Applied", "Reversal"];
exports.CREDIT_SOURCES = ["payment", "backfill", "import", "manual"];
exports.IMPORT_BATCH_STATUSES = ["Validated", "Committing", "Committed", "Discarded", "Failed"];
exports.IMPORT_ROW_STATUSES = ["Valid", "Error", "Duplicate", "Imported", "Skipped"];
/**
 * Finance categories (Step 8, Figma): stored as `category_key`; `category` keeps the
 * display label (or, for rows recorded before Step 8, the original free text).
 * Migration 065 mapped the old free-text categories onto these keys.
 */
exports.EXPENSE_CATEGORIES = ["StaffSalary", "Utilities", "Supplies", "Maintenance", "Other"];
exports.EXPENSE_CATEGORY_LABELS = { StaffSalary: "Staff Salary", Utilities: "Utilities", Supplies: "Supplies", Maintenance: "Maintenance", Other: "Other" };
/** Expense cards: Staff = Staff Salary, Other = everything else. */
exports.STAFF_EXPENSE_CATEGORY = "StaffSalary";
exports.INCOME_CATEGORIES = ["Donation", "Grant", "Misc"];
exports.INCOME_CATEGORY_LABELS = { Donation: "Donation", Grant: "Grant", Misc: "Misc Income" };
/** Fee income is never stored: it is derived from confirmed fee payments. */
exports.FEE_INCOME = { key: "FeeIncome", label: "Fee Income" };
