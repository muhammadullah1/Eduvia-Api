"use strict";

const examService = require("./exam.service");
const feeService = require("./fee.service");
const ApiError = require("../utils/ApiError");
const { textPdf } = require("../utils/pdf");

function dmcLines(dmc) {
  return [
    "Detailed Marks Certificate",
    `${dmc.student.name}  ${dmc.student.admissionNo}`,
    dmc.exam.name,
    ...dmc.subjects.map((item) => `${item.subject}: ${item.absent ? "Absent" : item.score} / ${item.max}  ${item.result}`),
    `Total ${dmc.total} / ${dmc.max}`,
    `Percentage ${dmc.percentage}`,
    `Grade ${dmc.grade}`,
    `Result ${dmc.passed ? "Pass" : "Fail"}`,
  ];
}

async function dmcPdf(user, examId, studentId) {
  return textPdf(dmcLines(await examService.dmc(user, examId, studentId)));
}

async function receiptPdf(user, paymentId) {
  const receipt = await feeService.receipt(user, paymentId);
  const months = (receipt.feeMonths || []).map((month) => `${month.label} ${month.amount}`).join(", ");
  return textPdf([
    "Fee receipt",
    `Receipt ${receipt.receiptNo}`,
    receipt.student ? `${receipt.student.name}  ${receipt.student.admissionNo}` : "",
    `Date ${receipt.paymentDate}`,
    `Method ${receipt.method}`,
    `Amount ${receipt.amount}`,
    months ? `Months ${months}` : "",
    receipt.notes || "",
  ].filter(Boolean));
}

function resultLines(title, data) {
  return [
    title,
    [data.exam && data.exam.name, data.classLabel, data.subject].filter(Boolean).join(" · "),
    ...data.rows.map((row) => {
      const mark = row.obtained == null ? row.result : `${row.obtained}/${row.total}`;
      return `${row.name}  ${mark}  ${row.percentage ?? "—"}%  ${row.grade || "—"}  ${row.result}  rank ${row.classRank ?? "—"}`;
    }),
  ];
}

async function examDocument(user, kind, examId, query) {
  if (kind === "overall") {
    // Ranks are per class, so the overall report is one block per class.
    const summary = await examService.listSummaries(user, {});
    const exam = summary.exams.find((item) => item.id === Number(examId));
    const classIds = exam ? exam.classes.map((klass) => klass.id) : [];
    const blocks = [];
    for (const classId of classIds) {
      blocks.push(await examService.results(user, examId, { classId }));
    }
    if (!blocks.length) blocks.push(await examService.results(user, examId, {}));
    if (query.format === "pdf") {
      return textPdf(["Overall examination report", ...blocks.flatMap((data) => resultLines("", data).slice(1))]);
    }
    return { classes: blocks };
  }
  if (!query.classId) throw new ApiError(400, "Choose a class for this document.");
  if (kind === "mark-sheet" && !query.subjectId) throw new ApiError(400, "Choose a subject for the mark sheet.");
  const data = await examService.results(user, examId, {
    classId: query.classId,
    subjectId: kind === "mark-sheet" ? query.subjectId : undefined,
  });
  const titles = {
    "result-sheet": "Result sheet",
    "mark-sheet": "Mark sheet",
    "class-report": "Class result report",
  };
  if (query.format === "pdf") return textPdf(resultLines(titles[kind] || "Examination document", data));
  return data;
}

module.exports = { dmcPdf, receiptPdf, examDocument };
