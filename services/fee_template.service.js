"use strict";

/**
 * Excel template for the offline fee import (`POST /fees/payments/import`).
 * The first sheet is the one the importer reads: the school letterhead, then
 * the column-header row (the importer finds it by its "Admission Number"
 * cell) and nothing else. The example and the rules live on a separate
 * "Instructions" sheet and can never be imported by accident.
 */
const ExcelJS = require("exceljs");
const { xlsxHeader, xlsxHeadRow } = require("../utils/branded_document");

/** Exactly the headers `feeService.importPayments` looks up (case-insensitive). */
const IMPORT_COLUMNS = ["Admission Number", "Month", "Amount", "Payment Date", "Receipt/Reference", "Payment Method", "Notes"];
const IMPORT_METHODS = ["Cash", "Bank Transfer", "Cheque", "Online"];

const COLUMN_WIDTHS = [18, 18, 12, 14, 22, 16, 30];

const INSTRUCTIONS = [
  ["Fill in the \"Payments\" sheet (the first sheet). Only that sheet is imported; this sheet is ignored."],
  ["One row per receipt, below the green header row. Keep the header row and the rows above it as they are."],
  [],
  ["Column", "Required", "Format / rule"],
  ["Admission Number", "Yes", "The student's admission number exactly as in Eduvia. The student must be enrolled (Active)."],
  ["Month", "Yes", "Fee month as YYYY-MM (e.g. 2026-10). Several months: 2026-09, 2026-10. Each month must already be on the student's fee ledger."],
  ["Amount", "Yes", "Amount received in PKR, a number greater than 0 (no commas or currency sign)."],
  ["Payment Date", "Yes", "Date the money was received, YYYY-MM-DD (e.g. 2026-10-05)."],
  ["Receipt/Reference", "Yes", "Paper receipt or bank reference. Must be unique: a reference that was already imported is skipped, never paid twice."],
  ["Payment Method", "No", `One of: ${IMPORT_METHODS.join(", ")}. Blank means Cash.`],
  ["Notes", "No", "Free text."],
  [],
  ["How the money is applied: every payment is allocated to the student's oldest unpaid month first, the same as a counter payment."],
  ["After upload you get a report of imported, skipped (duplicate reference) and failed rows with the reason for each failure."],
  [],
  ["EXAMPLE ONLY - do not copy this row into the Payments sheet"],
  IMPORT_COLUMNS,
  ["EXAMPLE-0001", "2026-10", 3500, "2026-10-05", "PAPER-RCPT-1001", "Cash", "Paid at the counter"],
];

/** The branded template workbook as XLSX bytes. `brand` from `schoolBranding()`. */
async function importTemplate(brand) {
  const book = new ExcelJS.Workbook();
  book.creator = brand.name;

  const payments = book.addWorksheet("Payments");
  payments.columns = COLUMN_WIDTHS.map((width) => ({ width }));
  const headRow = xlsxHeader(book, payments, brand, {
    title: "Offline fee import - payments",
    facts: [["How to fill", "One row per receipt below the green header. See the Instructions sheet."]],
    span: IMPORT_COLUMNS.length,
  });
  const head = payments.getRow(headRow);
  head.values = IMPORT_COLUMNS;
  xlsxHeadRow(head, brand);
  payments.views = [{ state: "frozen", ySplit: headRow }];

  const instructions = book.addWorksheet("Instructions");
  instructions.columns = [{ width: 22 }, { width: 12 }, { width: 110 }, { width: 14 }, { width: 20 }, { width: 14 }, { width: 22 }];
  const start = xlsxHeader(book, instructions, brand, { title: "Offline fee import - instructions", span: 3 });
  INSTRUCTIONS.forEach((values, i) => {
    const row = instructions.getRow(start + i);
    row.values = values;
    if (values[0] === "Column") xlsxHeadRow(row, brand);
  });
  return Buffer.from(await book.xlsx.writeBuffer());
}

module.exports = { importTemplate };
