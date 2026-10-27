"use strict";

/**
 * Financial report exports (Step 8): branded PDF (cards, income vs expenses bars,
 * breakdowns, monthly table, entries), XLSX (Summary / Monthly / Breakdown /
 * Income entries / Expense entries sheets) and sectioned CSV. Every format
 * carries the figures of `financeService.report(..., { withEntries: true })`.
 */
const ExcelJS = require("exceljs");
const { PdfDoc } = require("./pdf_doc");
const { rgb } = require("./branding");
const { money } = require("./report_export");
const { pdfHeader, pdfFooter, pdfTableStyle, xlsxHeader, xlsxHeadRow, csvPreamble } = require("./branded_document");

const GREEN = "16A34A";
const RED = "DC2626";
const BLUE = "2563EB";
const rs = (v) => `Rs ${money(v)}`;
const signed = (v) => (v < 0 ? `-Rs ${money(-v)}` : rs(v));

// The period label is the PDF subtitle (top right), so the fact boxes never cut it.
function facts(r, { withPeriod = true } = {}) {
  return [
    ...(withPeriod ? [["Period", r.period.label]] : []),
    ["From", r.period.from],
    ["To (exclusive)", r.period.to],
    ["Fee receipts", r.reconciliation.feeReceipts],
    ["Note", r.reconciliation.basis],
  ];
}

const summaryRows = (r) => [
  ["Total income", r.totals.income],
  ["  Fee income", r.totals.feeIncome],
  ["  Other income", r.totals.otherIncome],
  ["Total expenses", r.totals.expenses],
  ["  Staff salary", r.totals.staffExpenses],
  [`Net (${r.totals.position})`, r.totals.net],
];

const MONTH_COLS = ["Month", "Fee income", "Other income", "Total income", "Expenses", "Net"];
const monthLine = (s) => [s.label, s.feeIncome, s.otherIncome, s.income, s.expenses, s.net];
const INCOME_COLS = ["Date", "Category", "Description", "Reference", "Amount"];
const incomeLine = (e) => [e.date, e.categoryLabel, e.description, e.reference || "", e.amount];
const EXPENSE_COLS = ["Date", "Category", "Description", "Reference / invoice", "Payment method", "Amount"];
const expenseLine = (e) => [e.date, e.categoryLabel, e.description, e.referenceNo || "", e.paymentMethod || "", e.amount];

// ---- PDF -----------------------------------------------------------------

function cards(doc, brand, r) {
  const c = brand.colors;
  const m = doc.margin;
  const usable = doc.width - m * 2;
  const gap = 10;
  const w = (usable - gap * 2) / 3;
  const items = [
    ["TOTAL INCOME", rs(r.totals.income), `Fee ${rs(r.totals.feeIncome)} + Other ${rs(r.totals.otherIncome)}`, GREEN],
    ["TOTAL EXPENSES", rs(r.totals.expenses), `Staff ${rs(r.totals.staffExpenses)}`, RED],
    ["NET", signed(r.totals.net), r.totals.position, r.totals.net < 0 ? RED : BLUE],
  ];
  doc.ensure(64);
  items.forEach(([label, value, sub, tone], i) => {
    const x = m + i * (w + gap);
    doc.rect(x, doc.y, w, 54, { fill: rgb(c.brandWash), stroke: rgb(c.brandLine), width: 0.7 });
    doc.rect(x, doc.y, 3, 54, { fill: rgb(tone), stroke: false });
    doc.text(x + 10, doc.y + 14, label, { size: 7, bold: true, color: rgb(c.muted), width: w - 16 });
    doc.text(x + 10, doc.y + 32, value, { size: 14, bold: true, color: rgb(tone), width: w - 16 });
    doc.text(x + 10, doc.y + 46, sub, { size: 7, color: rgb(c.muted), width: w - 16 });
  });
  doc.cursorDown(66);
}

function section(doc, brand, title) {
  doc.ensure(40);
  doc.text(doc.margin, doc.y + 10, title, { size: 11, bold: true, color: rgb(brand.colors.brandDeep) });
  doc.cursorDown(18);
}

function barChart(doc, brand, r) {
  const c = brand.colors;
  const m = doc.margin;
  const usable = doc.width - m * 2;
  const h = 130;
  section(doc, brand, "Income vs expenses");
  doc.ensure(h + 30);
  const top = doc.y;
  const axisX = m + 48;
  const plotW = usable - 56;
  const max = Math.max(1, ...r.series.flatMap((s) => [s.income, s.expenses]));
  for (let i = 0; i <= 4; i += 1) {
    const y = top + h - (h * i) / 4;
    doc.line(axisX, y, axisX + plotW, y, { width: 0.3, color: rgb(c.line) });
    doc.text(m, y + 3, money(Math.round((max * i) / 4)), { size: 6.5, color: rgb(c.muted), width: 44, align: "right" });
  }
  const slot = plotW / r.series.length;
  const bw = Math.min(18, slot / 3);
  r.series.forEach((s, i) => {
    const x = axisX + i * slot + slot / 2 - bw;
    const ih = (h * s.income) / max;
    const eh = (h * s.expenses) / max;
    if (ih > 0) doc.rect(x, top + h - ih, bw, ih, { fill: rgb(GREEN), stroke: false });
    if (eh > 0) doc.rect(x + bw + 1, top + h - eh, bw, eh, { fill: rgb(RED), stroke: false });
    doc.text(axisX + i * slot, top + h + 11, s.label, { size: 7, color: rgb(c.muted), width: slot, align: "center" });
  });
  const ly = top + h + 22;
  doc.rect(axisX, ly, 8, 8, { fill: rgb(GREEN), stroke: false });
  doc.text(axisX + 12, ly + 7, "Income", { size: 7.5 });
  doc.rect(axisX + 60, ly, 8, 8, { fill: rgb(RED), stroke: false });
  doc.text(axisX + 72, ly + 7, "Expenses", { size: 7.5 });
  doc.y = ly + 16;
}

function breakdownTables(doc, brand, r) {
  const style = { size: 8.5, ...pdfTableStyle(brand) };
  const cols = [{ label: "Category", width: 3 }, { label: "Amount", width: 2, align: "right" }, { label: "Share", width: 1, align: "right" }];
  section(doc, brand, "Income breakdown");
  doc.table(cols, r.breakdown.income.map((b) => [b.label, rs(b.amount), `${b.percent}%`]), style);
  section(doc, brand, "Expense breakdown");
  if (!r.breakdown.expenses.length) {
    doc.text(doc.margin, doc.y + 8, "No expenses recorded in this period.", { size: 9, color: rgb(brand.colors.muted) });
    doc.cursorDown(14);
    return;
  }
  doc.table(cols, r.breakdown.expenses.map((b) => [b.label, rs(b.amount), `${b.percent}%`]), style);
}

function entryTable(doc, brand, title, cols, rows, emptyText) {
  section(doc, brand, title);
  if (!rows.length) {
    doc.text(doc.margin, doc.y + 8, emptyText, { size: 9, color: rgb(brand.colors.muted) });
    doc.cursorDown(14);
    return;
  }
  doc.table(cols, rows, { size: 8, ...pdfTableStyle(brand) });
}

function toPdf(r, brand) {
  const doc = new PdfDoc({ orientation: "portrait" });
  pdfHeader(doc, brand, { title: "Financial Report", subtitle: r.period.label, facts: facts(r, { withPeriod: false }) });
  cards(doc, brand, r);
  barChart(doc, brand, r);
  section(doc, brand, "Month by month");
  doc.table(
    MONTH_COLS.map((label, i) => ({ label, width: i ? 2 : 1.4, align: i ? "right" : "left" })),
    r.series.map((s) => monthLine(s).map((v, i) => (i ? (i === 5 ? signed(v) : rs(v)) : v))),
    { size: 8, ...pdfTableStyle(brand) },
  );
  breakdownTables(doc, brand, r);
  const left = (w) => ({ width: w });
  entryTable(doc, brand, "Income entries", [{ label: "Date", ...left(1.3) }, { label: "Category", ...left(1.4) }, { label: "Description", ...left(4) }, { label: "Reference", ...left(1.6) }, { label: "Amount", width: 1.5, align: "right" }], r.entries.income.map((e) => incomeLine(e).map((v, i) => (i === 4 ? rs(v) : v))), "No income in this period.");
  entryTable(doc, brand, "Expense entries", [{ label: "Date", ...left(1.3) }, { label: "Category", ...left(1.5) }, { label: "Description", ...left(3.4) }, { label: "Reference", ...left(1.5) }, { label: "Method", ...left(1.2) }, { label: "Amount", width: 1.5, align: "right" }], r.entries.expenses.map((e) => expenseLine(e).map((v, i) => (i === 5 ? rs(v) : v))), "No expenses in this period.");
  pdfFooter(doc, brand);
  return doc.toBuffer();
}

// ---- XLSX ----------------------------------------------------------------

function sheetTable(book, brand, name, title, r, columns, rows, moneyCols) {
  const sheet = book.addWorksheet(name, { pageSetup: { orientation: columns.length > 5 ? "landscape" : "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
  sheet.columns = columns.map((label) => ({ width: /Description/.test(label) ? 44 : 18 }));
  const start = xlsxHeader(book, sheet, brand, { title, facts: [["Period", r.period.label]], span: columns.length });
  const head = sheet.getRow(start);
  head.values = columns;
  xlsxHeadRow(head, brand);
  rows.forEach((values, i) => {
    const line = sheet.getRow(start + 1 + i);
    line.values = values;
    moneyCols.forEach((col) => {
      line.getCell(col + 1).numFmt = "#,##0.##";
    });
  });
  sheet.views = [{ state: "frozen", ySplit: start }];
  return sheet;
}

async function toXlsx(r, brand) {
  const book = new ExcelJS.Workbook();
  book.creator = brand.name;
  const title = `Financial Report — ${r.period.label}`;
  sheetTable(book, brand, "Summary", title, r, ["Item", "Amount"], [...summaryRows(r), ["Fee receipts", r.reconciliation.feeReceipts]], [1]);
  sheetTable(book, brand, "Monthly", `${title} — month by month`, r, MONTH_COLS, r.series.map(monthLine), [1, 2, 3, 4, 5]);
  sheetTable(
    book, brand, "Breakdown", `${title} — breakdown`, r, ["Type", "Category", "Amount", "Share %"],
    [...r.breakdown.income.map((b) => ["Income", b.label, b.amount, b.percent]), ...r.breakdown.expenses.map((b) => ["Expense", b.label, b.amount, b.percent])],
    [2],
  );
  sheetTable(book, brand, "Income entries", `${title} — income`, r, INCOME_COLS, r.entries.income.map(incomeLine), [4]);
  sheetTable(book, brand, "Expense entries", `${title} — expenses`, r, EXPENSE_COLS, r.entries.expenses.map(expenseLine), [5]);
  return Buffer.from(await book.xlsx.writeBuffer());
}

// ---- CSV -----------------------------------------------------------------

function safe(value) {
  if (value == null) return "";
  if (typeof value === "number") return String(value);
  const text = /^[=+\-@\t\r]/.test(String(value)) ? `'${value}` : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(r, brand) {
  const lines = csvPreamble(brand, { title: `Financial Report — ${r.period.label}`, facts: facts(r).filter(([k]) => k !== "Note") });
  const block = (name, cols, rows) => {
    lines.push([`# ${name}`], cols, ...rows, []);
  };
  block("Summary", ["Item", "Amount"], summaryRows(r).map(([k, v]) => [k.trim(), v]));
  block("Monthly", MONTH_COLS, r.series.map(monthLine));
  block("Breakdown", ["Type", "Category", "Amount", "Share %"], [...r.breakdown.income.map((b) => ["Income", b.label, b.amount, b.percent]), ...r.breakdown.expenses.map((b) => ["Expense", b.label, b.amount, b.percent])]);
  block("Income entries", INCOME_COLS, r.entries.income.map(incomeLine));
  block("Expense entries", EXPENSE_COLS, r.entries.expenses.map(expenseLine));
  return Buffer.from(`\uFEFF${lines.map((l) => l.map(safe).join(",")).join("\r\n")}\r\n`, "utf8");
}

async function renderFinance(report, format, brand) {
  if (format === "pdf") return toPdf(report, brand);
  if (format === "xlsx") return toXlsx(report, brand);
  if (format === "csv") return toCsv(report, brand);
  throw new Error(`Unknown format ${format}`);
}

module.exports = { renderFinance };
