"use strict";

/**
 * Excel template for the offline fee import (`POST /fees/imports/validate`, then `/fees/imports/:id/commit`).
 * The first sheet is the one the importer reads: the school letterhead, then
 * the column-header row (the importer finds it by its "Admission Number"
 * cell) and nothing else. The example and the rules live on a separate
 * "Instructions" sheet and can never be imported by accident.
 */
const ExcelJS = require("exceljs");
const { xlsxHeader, xlsxHeadRow } = require("../utils/branded_document");

/** Exactly the headers `fee_import.service` looks up (case-insensitive), in the Figma order. */
const IMPORT_COLUMNS = ["Admission Number", "Student Name", "Class", "Month(s)", "Amount", "Payment Date", "Receipt/Reference No.", "Payment Method", "Notes"];
const IMPORT_METHODS = ["Cash", "Bank Transfer", "Cheque", "Online"];

const COLUMN_WIDTHS = [18, 22, 14, 16, 12, 14, 22, 16, 30];

const INSTRUCTIONS = [
  ["Fill in the \"Payments\" sheet (the first sheet). Only that sheet is imported; this sheet is ignored."],
  ["One row per receipt, below the green header row. Keep the header row and the rows above it as they are."],
  [],
  ["Column", "Required", "Format / rule"],
  ["Admission Number", "Yes", "The student ID (admission number) exactly as in Eduvia. The student must be enrolled (Active or Pending)."],
  ["Student Name", "No", "For your reference only; the admission number decides the student."],
  ["Class", "No", "Optional check: when filled it must match the student's class in Eduvia."],
  ["Month(s)", "Yes", "Fee month as YYYY-MM (e.g. 2026-09). Several months: 2026-08, 2026-09. Each month must be on the student's fee ledger and not after the payment date."],
  ["Amount", "Yes", "Amount received in PKR, a number greater than 0 (no currency sign). At most 2 decimals."],
  ["Payment Date", "Yes", "Date the money was received, YYYY-MM-DD (e.g. 2026-10-05). Not in the future."],
  ["Receipt/Reference No.", "Yes", "Paper receipt or bank reference. Must be unique: a receipt that already exists is skipped, never paid twice."],
  ["Payment Method", "No", `One of: ${IMPORT_METHODS.join(", ")}. Blank means Cash.`],
  ["Notes", "No", "Free text, up to 500 characters."],
  [],
  ["How the money is applied: the same as a counter payment - the student's oldest unpaid bill first. Money beyond what is owed becomes student credit; future months are never pre-paid."],
  ["Safe to run twice: rows whose receipt was already imported are skipped. Limits: .xlsx or .xls, up to 700 KB and 1,000 rows per file."],
  [],
  ["EXAMPLE ONLY - do not copy this row into the Payments sheet"],
  IMPORT_COLUMNS,
  ["EXAMPLE-0001", "Aisha Noor", "Class 1 - A", "2026-10", 3500, "2026-10-05", "PAPER-RCPT-1001", "Cash", "Paid at the counter"],
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
  // Month(s), Payment Date and Receipt as text, so Excel does not turn 2026-09 into a date or drop leading zeros.
  for (const col of [1, 4, 6, 7]) payments.getColumn(col).numFmt = "@";

  const instructions = book.addWorksheet("Instructions");
  instructions.columns = [{ width: 22 }, { width: 12 }, { width: 110 }, { width: 14 }, { width: 12 }, { width: 14 }, { width: 22 }, { width: 14 }, { width: 22 }];
  const start = xlsxHeader(book, instructions, brand, { title: "Offline fee import - instructions", span: 3 });
  INSTRUCTIONS.forEach((values, i) => {
    const row = instructions.getRow(start + i);
    row.values = values;
    if (values[0] === "Column") xlsxHeadRow(row, brand);
  });
  return Buffer.from(await book.xlsx.writeBuffer());
}

module.exports = { importTemplate };
