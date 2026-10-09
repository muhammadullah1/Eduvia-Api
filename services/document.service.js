"use strict";

const examService = require("./exam.service");
const feeService = require("./fee.service");
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

module.exports = { dmcPdf, receiptPdf };
