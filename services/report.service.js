"use strict";

const {
  AcademicSessions,
  Classes,
  Subjects,
  Teachers,
  Students,
  Exams,
  MarkSheets,
  MarkSheetRows,
  FeePayments,
  StudentFeeMonths,
  Expenses,
} = require("../models");
const { USER_ROLES, STUDENT_STATUS, SHEET_STATUS } = require("../constants");
const { can } = require("../constants/permissions");
const teacherService = require("./teacher.service");
const parentService = require("./parent.service");
const { today } = require("../utils/dates");

function monthStamp(value) {
  return String(value).slice(0, 7);
}

function inSession(value, session) {
  if (!session || !value) return false;
  const day = String(value).slice(0, 10);
  return day >= session.startDate && day <= session.endDate;
}

async function managementDashboard(user) {
  const schoolId = user.schoolId;
  const session = await AcademicSessions.findOne({ where: { fkSchoolId: schoolId, isCurrent: true } });
  const current = monthStamp(today());
  const [classCount, subjectCount, teacherCount, students, exams, sheets, feeMonths, payments, expenses, classRows] = await Promise.all([
    Classes.count({ where: { fkSchoolId: schoolId, ...(session ? { fkSessionId: session.id } : {}) } }),
    Subjects.count({ where: { fkSchoolId: schoolId } }),
    Teachers.count({ where: { fkSchoolId: schoolId } }),
    Students.findAll({ where: { fkSchoolId: schoolId }, attributes: ["status", "fkClassId", "admissionDate"] }),
    Exams.findAll({ where: { fkSchoolId: schoolId }, attributes: ["id", "startDate"] }),
    MarkSheets.findAll({
      where: { fkSchoolId: schoolId },
      attributes: ["id", "status", "fkClassId", "totalMarks", "passingMarks"],
      include: [{ model: MarkSheetRows, as: "rows", attributes: ["obtainedMarks", "isAbsent"] }],
    }),
    StudentFeeMonths.findAll({ where: { fkSchoolId: schoolId }, attributes: ["month", "status", "netAmount", "paidAmount"] }),
    FeePayments.findAll({ where: { fkSchoolId: schoolId, status: "Paid" }, attributes: ["amountPaid", "paymentDate"] }),
    Expenses.findAll({ where: { fkSchoolId: schoolId }, attributes: ["amount", "expenseDate"] }),
    Classes.findAll({ where: { fkSchoolId: schoolId }, attributes: ["id", "label"] }),
  ]);

  const byStatus = {};
  for (const student of students) byStatus[student.status] = (byStatus[student.status] || 0) + 1;
  const pendingMarks = sheets.filter((sheet) => sheet.status === SHEET_STATUS.DRAFT || sheet.status === SHEET_STATUS.SUBMITTED).length;
  const published = sheets.filter((sheet) => sheet.status === SHEET_STATUS.PUBLISHED);
  let scored = 0;
  let passed = 0;
  for (const sheet of published) {
    for (const row of sheet.rows) {
      if (row.isAbsent || row.obtainedMarks == null) continue;
      scored += 1;
      if (Number(row.obtainedMarks) >= Number(sheet.passingMarks)) passed += 1;
    }
  }

  const cards = {
    academic: {
      session: session ? session.name : null,
      classes: classCount,
      subjects: subjectCount,
      teachers: teacherCount,
    },
    students: {
      total: students.length,
      active: byStatus[STUDENT_STATUS.ACTIVE] || 0,
      inactive: byStatus[STUDENT_STATUS.INACTIVE] || 0,
      newAdmissions: session ? students.filter((student) => inSession(student.admissionDate, session)).length : 0,
      graduated: byStatus[STUDENT_STATUS.GRADUATED] || 0,
      struckOff: byStatus[STUDENT_STATUS.STRUCK_OFF] || 0,
    },
    examinations: {
      upcoming: exams.filter((exam) => exam.startDate && String(exam.startDate) >= today()).length,
      finalized: published.length,
      pendingMarks,
      passRate: scored ? Math.round((passed / scored) * 10000) / 100 : null,
    },
  };

  const classLabels = Object.fromEntries(classRows.map((row) => [row.id, row.label]));
  const distribution = {};
  for (const student of students.filter((row) => row.status === STUDENT_STATUS.ACTIVE)) {
    const label = classLabels[student.fkClassId] || "Unassigned";
    distribution[label] = (distribution[label] || 0) + 1;
  }
  const admissions = {};
  for (const student of students) {
    if (!student.admissionDate) continue;
    const key = monthStamp(student.admissionDate);
    admissions[key] = (admissions[key] || 0) + 1;
  }
  const performance = {};
  for (const sheet of published) {
    const label = classLabels[sheet.fkClassId] || `Class ${sheet.fkClassId}`;
    const rows = sheet.rows.filter((row) => row.obtainedMarks != null && !row.isAbsent);
    if (!rows.length || !Number(sheet.totalMarks)) continue;
    const average = rows.reduce((sum, row) => sum + (Number(row.obtainedMarks) / Number(sheet.totalMarks)) * 100, 0) / rows.length;
    performance[label] = performance[label] || [];
    performance[label].push(average);
  }

  const graphs = {
    studentsByClass: Object.entries(distribution).map(([label, count]) => ({ label, count })),
    admissionTrend: Object.entries(admissions).sort(([a], [b]) => a.localeCompare(b)).map(([month, count]) => ({ month, count })),
    examinationPerformance: Object.entries(performance).map(([label, values]) => ({
      label,
      averagePercent: Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100,
    })),
  };

  if (can(user.role, "fees.totals")) {
    const sessionPayments = payments.filter((payment) => !session || inSession(payment.paymentDate, session));
    const sessionExpenses = expenses.filter((expense) => !session || inSession(expense.expenseDate, session));
    const thisMonth = feeMonths.filter((month) => monthStamp(month.month) === current);
    const income = sessionPayments.reduce((sum, payment) => sum + Number(payment.amountPaid), 0);
    const expenseTotal = sessionExpenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
    cards.fees = {
      collectedThisMonth: sessionPayments
        .filter((payment) => monthStamp(payment.paymentDate) === current)
        .reduce((sum, payment) => sum + Number(payment.amountPaid), 0),
      paidValue: thisMonth.reduce((sum, month) => sum + Number(month.paidAmount), 0),
      unpaidValue: thisMonth.reduce((sum, month) => sum + Math.max(0, Number(month.netAmount) - Number(month.paidAmount)), 0),
      outstanding: feeMonths
        .filter((month) => monthStamp(month.month) <= current)
        .reduce((sum, month) => sum + Math.max(0, Number(month.netAmount) - Number(month.paidAmount)), 0),
      advance: feeMonths.filter((month) => month.status === "Advance").reduce((sum, month) => sum + Number(month.paidAmount), 0),
    };
    cards.finance = { income, expenses: expenseTotal, net: income - expenseTotal };
    const collection = {};
    for (const payment of sessionPayments) {
      const key = monthStamp(payment.paymentDate);
      collection[key] = (collection[key] || 0) + Number(payment.amountPaid);
    }
    const expenseByMonth = {};
    for (const expense of sessionExpenses) {
      const key = monthStamp(expense.expenseDate);
      expenseByMonth[key] = (expenseByMonth[key] || 0) + Number(expense.amount);
    }
    graphs.monthlyFeeCollection = Object.entries(collection).sort(([a], [b]) => a.localeCompare(b)).map(([month, amount]) => ({ month, amount }));
    graphs.paidVsUnpaid = [
      { label: "Paid", count: thisMonth.filter((month) => month.status === "Paid" || month.status === "Advance").length },
      { label: "Unpaid", count: thisMonth.filter((month) => month.status === "Unpaid" || month.status === "Partially Paid").length },
    ];
    graphs.incomeVsExpenses = [...new Set([...Object.keys(collection), ...Object.keys(expenseByMonth)])].sort().map((month) => ({
      month,
      income: collection[month] || 0,
      expenses: expenseByMonth[month] || 0,
    }));
  }

  return { role: user.role, cards, graphs };
}

async function dashboard(user) {
  if (user.role === USER_ROLES.TEACHER) {
    return { role: user.role, schedule: await teacherService.mySchedule(user, today()) };
  }
  if (user.role === USER_ROLES.PARENT) {
    return { role: user.role, children: await parentService.myChildren(user) };
  }
  if (user.role === USER_ROLES.ACCOUNTANT) {
    return { role: user.role, cards: {}, graphs: {} };
  }
  return managementDashboard(user);
}

module.exports = { dashboard };
