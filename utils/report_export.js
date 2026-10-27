"use strict";

/**
 * Turns one tabular report ({ title, meta, columns, rows, summary }) into a
 * downloadable CSV, XLSX or PDF carrying the school letterhead (see
 * `branded_document.js`). Every format carries the same rows, so a
 * downloaded file always matches what the screen showed.
 *
 *   columns: [{ key, label, type: "text" | "number" | "money" | "percent", width }]
 *   meta:    [[label, value]]   (the filters the report was run with)
 *   summary: [[label, value]] or null (totals; omitted for roles without totals)
 */
const ExcelJS = require("exceljs");
const { PdfDoc } = require("./pdf_doc");
const { rgb } = require("./branding");
const { pdfHeader, pdfFooter, pdfTableStyle, xlsxHeader, xlsxHeadRow, csvPreamble } = require("./branded_document");

const MIME = {
  csv: "text/csv; charset=utf-8",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pdf: "application/pdf",
};

const money = (value) =>
  Number(value || 0).toLocaleString("en-PK", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

const isNumeric = (column) => column.type === "money" || column.type === "number" || column.type === "percent";

function cellText(column, value) {
  if (value == null || value === "") return "";
  if (column.type === "money") return money(value);
  if (column.type === "percent") return `${value}%`;
  return String(value);
}

function rawValue(column, value) {
  if (value == null || value === "") return "";
  return isNumeric(column) ? Number(value) : String(value);
}

/** Spreadsheet apps run cells starting with = + - @ as formulas; neutralise text ones. */
function safeCsvText(value) {
  const text = String(value);
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}

function csvField(value) {
  const text = value == null ? "" : typeof value === "number" ? String(value) : safeCsvText(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Joins rows of fields into CSV bytes (with a BOM so Excel reads UTF-8 names). */
function csvBuffer(lines) {
  return Buffer.from(`\uFEFF${lines.map((line) => line.map(csvField).join(",")).join("\r\n")}\r\n`, "utf8");
}

function toCsv(report, brand) {
  const lines = csvPreamble(brand, { title: report.title, facts: report.meta });
  lines.push(report.columns.map((c) => c.label));
  for (const row of report.rows) lines.push(report.columns.map((c) => rawValue(c, row[c.key])));
  if (report.summary && report.summary.length) {
    lines.push([]);
    for (const [label, value] of report.summary) lines.push([label, value]);
  }
  return csvBuffer(lines);
}

async function toXlsx(report, brand) {
  const book = new ExcelJS.Workbook();
  book.creator = brand.name;
  const sheet = book.addWorksheet("Report", { pageSetup: { orientation: report.columns.length > 6 ? "landscape" : "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
  sheet.columns = report.columns.map((c) => ({ width: Math.max(12, Math.min(40, (c.label || "").length + 4, c.chars || 18)) }));
  const headRow = xlsxHeader(book, sheet, brand, { title: report.title, facts: report.meta, span: report.columns.length });
  const head = sheet.getRow(headRow);
  head.values = report.columns.map((c) => c.label);
  xlsxHeadRow(head, brand);
  report.rows.forEach((row, i) => {
    const line = sheet.getRow(headRow + 1 + i);
    line.values = report.columns.map((c) => rawValue(c, row[c.key]));
    report.columns.forEach((c, col) => {
      if (isNumeric(c)) line.getCell(col + 1).numFmt = c.type === "money" ? "#,##0.##" : c.type === "percent" ? '0.0"%"' : "0";
    });
  });
  sheet.views = [{ state: "frozen", ySplit: headRow }];
  sheet.autoFilter = { from: { row: headRow, column: 1 }, to: { row: headRow + report.rows.length, column: report.columns.length } };
  if (report.summary && report.summary.length) {
    const summary = book.addWorksheet("Summary");
    summary.columns = [{ width: 30 }, { width: 20 }];
    const start = xlsxHeader(book, summary, brand, { title: `${report.title} - summary`, facts: report.meta, span: 2 });
    const head2 = summary.getRow(start);
    head2.values = ["Summary", ""];
    xlsxHeadRow(head2, brand);
    report.summary.forEach(([label, value], i) => {
      summary.getRow(start + 1 + i).values = [label, value];
    });
  }
  return Buffer.from(await book.xlsx.writeBuffer());
}

function toPdf(report, brand) {
  const doc = new PdfDoc({ orientation: report.columns.length > 6 ? "landscape" : "portrait" });
  pdfHeader(doc, brand, { title: report.title, facts: report.meta });
  const columns = report.columns.map((c) => ({ label: c.label, width: c.width || 1, align: isNumeric(c) ? "right" : "left" }));
  const rows = report.rows.map((row) => report.columns.map((c) => cellText(c, row[c.key])));
  if (!rows.length) {
    doc.text(doc.margin, doc.y + 10, "No records match these filters.", { size: 10 });
    doc.cursorDown(16);
  } else {
    doc.table(columns, rows, { size: 8.5, ...pdfTableStyle(brand) });
  }
  if (report.summary && report.summary.length) {
    doc.ensure(20 + report.summary.length * 14);
    doc.cursorDown(12);
    doc.text(doc.margin, doc.y + 10, "Summary", { size: 11, bold: true, color: rgb(brand.colors.brand) });
    doc.cursorDown(16);
    for (const [label, value] of report.summary) {
      doc.text(doc.margin, doc.y + 10, label, { size: 9.5, width: 200 });
      doc.text(doc.margin + 200, doc.y + 10, String(value), { size: 9.5, bold: true, width: 160 });
      doc.cursorDown(14);
    }
  }
  pdfFooter(doc, brand);
  return doc.toBuffer();
}

/** Renders `report` as `format` with the school's letterhead (`brand`). */
async function render(report, format, brand) {
  if (format === "csv") return toCsv(report, brand);
  if (format === "xlsx") return toXlsx(report, brand);
  if (format === "pdf") return toPdf(report, brand);
  throw new Error(`Unknown format ${format}`);
}

/** Sends `buffer` as an attachment with a safe ASCII filename. */
function sendFile(res, buffer, format, basename) {
  const name = `${String(basename).replace(/[^A-Za-z0-9._-]+/g, "-")}.${format}`;
  res.set("Content-Type", MIME[format]);
  res.set("Content-Disposition", `attachment; filename="${name}"`);
  res.set("Cache-Control", "no-store");
  // Lets a cross-origin portal read the server's file name.
  res.set("Access-Control-Expose-Headers", "Content-Disposition");
  return res.send(buffer);
}

module.exports = { render, sendFile, money };
