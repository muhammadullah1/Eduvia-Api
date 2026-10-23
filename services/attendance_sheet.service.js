"use strict";

/**
 * Printable paper attendance register (EDUVIA-14): one class for one day
 * (tick boxes for P / A / L / Leave) or for a whole month (one box per day),
 * with the class's Super Master and signature lines. Read-only: it never
 * writes attendance. The roster is the class's Active students, the same list
 * the on-screen register uses.
 */
const ExcelJS = require("exceljs");
const { QueryTypes } = require("sequelize");
const { sequelize, Classes, AcademicSessions } = require("../models");
const ApiError = require("../utils/ApiError");
const { PdfDoc } = require("../utils/pdf_doc");
const { rgb, schoolBranding } = require("../utils/branding");
const { pdfHeader, pdfFooter, xlsxHeader, xlsxHeadRow } = require("../utils/branded_document");
const { today: schoolToday, parse, iso } = require("../utils/dates");
const superMasterService = require("./super_master.service");

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const STATUS_BOXES = ["P", "A", "L", "Leave"];
const LEGEND = "P = Present   A = Absent   L = Late   Lv = Leave";

const fullName = (r) => [r.first_name, r.last_name].filter(Boolean).join(" ").trim();

function daysOf(month) {
  const out = [];
  const d = parse(`${month}-01`);
  while (iso(d).startsWith(month)) {
    out.push({ date: iso(d), day: d.getUTCDate(), weekday: d.getUTCDay() });
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

function longDate(date) {
  const d = parse(date);
  return `${["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][d.getUTCDay()]}, ${d.getUTCDate()} ${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

const monthTitle = (month) => `${MONTH_NAMES[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;

/** Everything a sheet needs, independent of the output format. */
async function sheetData(actor, { classId, date, month }) {
  const klass = await Classes.findOne({ where: { id: classId, fkSchoolId: actor.schoolId } });
  if (!klass) throw new ApiError(404, "Class not found");
  const mode = month ? "month" : "day";
  const day = mode === "day" ? date || schoolToday() : null;
  const [brand, session, resp, students] = await Promise.all([
    schoolBranding(actor.schoolId, actor.id),
    klass.fkSessionId ? AcademicSessions.findByPk(klass.fkSessionId, { attributes: ["id", "name"] }) : null,
    superMasterService.responsibility(actor.schoolId, [klass.id], day || schoolToday()),
    sequelize.query(
      `SELECT s.id, s.admission_no, s.first_name, s.last_name
         FROM students s
        WHERE s.fk_school_id = :schoolId AND s.archived_at IS NULL AND s.fk_class_id = :classId AND s.status = 'Active'
        ORDER BY s.first_name, s.last_name, s.id`,
      { replacements: { schoolId: actor.schoolId, classId: klass.id }, type: QueryTypes.SELECT },
    ),
  ]);
  const r = resp[klass.id] || {};
  const superMaster = r.superMaster ? r.superMaster.name : "Not assigned";
  return {
    mode,
    date: day,
    month: month || null,
    days: month ? daysOf(month) : [],
    brand,
    session: session ? session.name : "",
    classLabel: klass.label,
    superMaster: r.state === "inactive" ? `${superMaster} (inactive)` : superMaster,
    students: students.map((s, i) => ({ roll: i + 1, admissionNo: s.admission_no, name: fullName(s) })),
  };
}

function filename(data) {
  const label = data.classLabel.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `attendance-sheet-${label}-${data.mode === "day" ? data.date : data.month}`;
}

// ---- PDF -----------------------------------------------------------------

const sheetTitle = (data) => (data.mode === "day" ? "Daily attendance sheet" : "Monthly attendance register");

function sheetFacts(data) {
  return [
    ["Class", data.classLabel],
    [data.mode === "day" ? "Date" : "Month", data.mode === "day" ? longDate(data.date) : monthTitle(data.month)],
    ["Super Master", data.superMaster],
    ["Session", data.session || "-"],
  ];
}

/** Letterhead on every page, so loose printed pages still say what they are. */
function header(doc, data) {
  pdfHeader(doc, data.brand, { title: sheetTitle(data), facts: sheetFacts(data) });
}

/** Brand-coloured table header band. */
function headBand(doc, data, x, y, w, h) {
  doc.rect(x, y, w, h, { fill: rgb(data.brand.colors.brand), stroke: false });
}

const WHITE = [1, 1, 1];

function signatures(doc, data) {
  const m = doc.margin;
  const usable = doc.width - m * 2;
  doc.ensure(70);
  doc.cursorDown(10);
  const y = doc.y;
  if (data.mode === "day") {
    doc.text(m, y + 10, "Present ______   Absent ______   Late ______   Leave ______   Total on roll: " + data.students.length, { size: 9 });
  } else {
    doc.text(m, y + 10, LEGEND + "   (shaded columns are Sundays)", { size: 8.5 });
  }
  const lineY = y + 52;
  const w = (usable - 40) / 3;
  [["Super Master signature", data.superMaster], ["Checked by (office)", ""], ["Date", ""]].forEach(([label, sub], i) => {
    const x = m + i * (w + 20);
    doc.line(x, lineY, x + w, lineY, { width: 0.6 });
    doc.text(x, lineY + 11, label, { size: 8.5 });
    if (sub) doc.text(x, lineY + 22, sub, { size: 7.5, color: rgb(data.brand.colors.muted), width: w });
  });
  doc.cursorDown(80);
}

function dayPdf(data) {
  const doc = new PdfDoc({ orientation: "portrait", margin: 36 });
  const m = doc.margin;
  const usable = doc.width - m * 2;
  const cols = [
    { label: "#", w: 26 },
    { label: "Admission no", w: 82 },
    { label: "Student name", w: 170 },
    ...STATUS_BOXES.map((label) => ({ label, w: 38, box: true })),
  ];
  const fixed = cols.reduce((s, c) => s + c.w, 0);
  cols.push({ label: "Remarks", w: usable - fixed });
  const rowH = 20;
  const tableHeader = () => {
    let x = m;
    headBand(doc, data, m, doc.y, usable, rowH);
    for (const c of cols) {
      doc.text(x + 4, doc.y + 13, c.label, { size: 8.5, bold: true, width: c.w - 8, align: c.box ? "center" : "left", color: WHITE });
      x += c.w;
    }
    doc.cursorDown(rowH);
  };
  header(doc, data);
  tableHeader();
  if (!data.students.length) {
    doc.text(m, doc.y + 14, "No active students in this class.", { size: 10 });
    doc.cursorDown(20);
  }
  for (const s of data.students) {
    if (doc.remaining() < rowH + 4) {
      doc.addPage();
      header(doc, data);
      tableHeader();
    }
    let x = m;
    const values = [String(s.roll), s.admissionNo, s.name];
    cols.forEach((c, i) => {
      if (c.box) {
        doc.rect(x + c.w / 2 - 6, doc.y + 4, 12, 12, { width: 0.7 });
      } else if (i < values.length) {
        doc.text(x + 4, doc.y + 13.5, values[i], { size: 9, width: c.w - 8 });
      }
      x += c.w;
    });
    doc.line(m, doc.y + rowH, m + usable, doc.y + rowH, { gray: 0.75 });
    doc.cursorDown(rowH);
  }
  signatures(doc, data);
  pdfFooter(doc, data.brand);
  return doc.toBuffer();
}

function monthPdf(data) {
  const doc = new PdfDoc({ orientation: "landscape", margin: 24 });
  const m = doc.margin;
  const usable = doc.width - m * 2;
  const totals = ["P", "A", "L", "Lv"];
  const fixed = [{ label: "#", w: 18 }, { label: "Adm no", w: 52 }, { label: "Student name", w: 118 }];
  const fixedW = fixed.reduce((s, c) => s + c.w, 0);
  const totalW = 20;
  const dayW = (usable - fixedW - totals.length * totalW) / data.days.length;
  const rowH = 16;
  const sunday = rgb(data.brand.colors.brandWash);
  const tableHeader = () => {
    const top = doc.y;
    headBand(doc, data, m, top, usable, rowH * 1.6);
    let x = m;
    for (const c of fixed) {
      doc.text(x + 3, top + 16, c.label, { size: 7.5, bold: true, width: c.w - 6, color: WHITE });
      x += c.w;
    }
    for (const d of data.days) {
      if (d.weekday === 0) doc.rect(x, top, dayW, rowH * 1.6, { fill: rgb(data.brand.colors.brandDeep), stroke: false });
      doc.text(x, top + 10, String(d.day), { size: 7, bold: true, width: dayW, align: "center", color: WHITE });
      doc.text(x, top + 21, WEEKDAY_SHORT[d.weekday].slice(0, 2), { size: 5.5, width: dayW, align: "center", color: WHITE });
      x += dayW;
    }
    for (const t of totals) {
      doc.text(x, top + 16, t, { size: 7.5, bold: true, width: totalW, align: "center", color: WHITE });
      x += totalW;
    }
    doc.cursorDown(rowH * 1.6);
  };
  header(doc, data);
  tableHeader();
  if (!data.students.length) {
    doc.text(m, doc.y + 14, "No active students in this class.", { size: 10 });
    doc.cursorDown(20);
  }
  for (const s of data.students) {
    if (doc.remaining() < rowH + 4) {
      doc.addPage();
      header(doc, data);
      tableHeader();
    }
    const top = doc.y;
    let x = m;
    [String(s.roll), s.admissionNo, s.name].forEach((value, i) => {
      doc.text(x + 3, top + 11, value, { size: 7.5, width: fixed[i].w - 6 });
      x += fixed[i].w;
    });
    for (const d of data.days) {
      doc.rect(x, top, dayW, rowH, { fill: d.weekday === 0 ? sunday : undefined, width: 0.4 });
      x += dayW;
    }
    for (let i = 0; i < totals.length; i += 1) {
      doc.rect(x, top, totalW, rowH, { width: 0.4 });
      x += totalW;
    }
    doc.cursorDown(rowH);
  }
  signatures(doc, data);
  pdfFooter(doc, data.brand);
  return doc.toBuffer();
}

// ---- XLSX ----------------------------------------------------------------

async function sheetXlsx(data) {
  let head;
  let rows;
  if (data.mode === "day") {
    head = ["#", "Admission no", "Student name", "P", "A", "L", "Leave", "Remarks"];
    rows = data.students.map((s) => [s.roll, s.admissionNo, s.name, "", "", "", "", ""]);
  } else {
    head = ["#", "Admission no", "Student name", ...data.days.map((d) => `${d.day} ${WEEKDAY_SHORT[d.weekday]}`), "P", "A", "L", "Lv"];
    rows = data.students.map((s) => [s.roll, s.admissionNo, s.name, ...data.days.map(() => ""), "", "", "", ""]);
  }
  const book = new ExcelJS.Workbook();
  book.creator = data.brand.name;
  const sheet = book.addWorksheet("Attendance", {
    pageSetup: { orientation: data.mode === "day" ? "portrait" : "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  sheet.columns = head.map((_, i) => ({ width: i === 2 ? 28 : i === 1 ? 14 : i === 0 ? 5 : data.mode === "day" ? 9 : 6 }));
  const headRow = xlsxHeader(book, sheet, data.brand, {
    title: sheetTitle(data),
    facts: [...sheetFacts(data), ["Legend", LEGEND]],
    span: head.length,
  });
  const headLine = sheet.getRow(headRow);
  headLine.values = head;
  xlsxHeadRow(headLine, data.brand);
  rows.forEach((values, i) => {
    sheet.getRow(headRow + 1 + i).values = values;
  });
  const end = headRow + rows.length + 2;
  [["Super Master signature", "", data.superMaster], ["Checked by (office)"], ["Date"]].forEach((values, i) => {
    sheet.getRow(end + i).values = values;
  });
  sheet.views = [{ state: "frozen", ySplit: headRow }];
  return Buffer.from(await book.xlsx.writeBuffer());
}

async function render(actor, filters) {
  const data = await sheetData(actor, filters);
  const format = filters.format || "pdf";
  const buffer = format === "xlsx" ? await sheetXlsx(data) : data.mode === "day" ? dayPdf(data) : monthPdf(data);
  return { buffer, format, filename: filename(data), data };
}

module.exports = { render };
