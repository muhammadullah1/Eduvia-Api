"use strict";

const { gradeFor, paperOutcome, overallOutcome } = require("../../services/exam.service");
const { sortClasses } = require("../../utils/class_order");

const sheet = (subject, total, passing) => ({ fkSubjectId: subject, subject: { name: `S${subject}` }, totalMarks: total, passingMarks: passing });

describe("exam grading", () => {
  test("a passed paper is never F and a failed paper is always F", () => {
    expect(gradeFor(40, true)).toBe("E");
    expect(gradeFor(47, true)).toBe("E");
    expect(gradeFor(55, true)).toBe("D");
    expect(gradeFor(92, true)).toBe("A+");
    expect(gradeFor(95, false)).toBe("F");
  });

  test("each paper uses its own passing marks", () => {
    expect(paperOutcome(sheet(1, 100, 40), { score: 40 }).status).toBe("Pass");
    expect(paperOutcome(sheet(1, 100, 40), { score: 39 }).status).toBe("Fail");
    expect(paperOutcome(sheet(2, 50, 25), { score: 25 }).status).toBe("Pass");
    expect(paperOutcome(sheet(3, 75, 30), { isAbsent: true }).status).toBe("Absent");
    expect(paperOutcome(sheet(3, 75, 30), { isExempt: true }).status).toBe("Exempt");
  });

  test("overall passes only when every counted paper passes; absent fails, exempt is excluded", () => {
    const pass = overallOutcome([
      paperOutcome(sheet(1, 100, 40), { score: 80 }),
      paperOutcome(sheet(2, 50, 25), { isExempt: true }),
    ]);
    expect(pass).toMatchObject({ result: "Pass", obtained: 80, total: 100, percentage: 80, grade: "A" });
    const absent = overallOutcome([
      paperOutcome(sheet(1, 100, 40), { score: 95 }),
      paperOutcome(sheet(2, 50, 25), { isAbsent: true }),
    ]);
    expect(absent).toMatchObject({ result: "Fail", failedPapers: 1, grade: "F" });
    const pending = overallOutcome([paperOutcome(sheet(1, 100, 40), { score: null })]);
    expect(pending).toMatchObject({ result: "Pending", grade: null, percentage: null });
  });

  test("classes sort in school order", () => {
    const labels = sortClasses([
      { grade: "Grade 10", section: "A" }, { grade: "Grade 2" }, { grade: "PREP" }, { grade: "Grade 1" }, { grade: "KG" },
    ]).map((klass) => klass.grade);
    expect(labels).toEqual(["KG", "PREP", "Grade 1", "Grade 2", "Grade 10"]);
  });
});
