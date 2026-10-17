"use strict";

const timetableService = require("../../services/timetable.service");

describe("timetable.service slotPayload", () => {
  test("create accepts optional teacher via resolve path", async () => {
    const payload = timetableService.slotPayload({
      fkClassId: 1,
      day: "Monday",
      periodIndex: 1,
      startTime: "08:00",
      fkSubjectId: 2,
      fkTeacherId: null,
      room: "Lab",
    });
    expect(payload.fkTeacherId).toBeNull();
    expect(payload.fkSubjectId).toBe(2);
    expect(payload.startTime).toBe("08:00");
  });

  test("groups a teacher time clash and ignores a different start time", () => {
    const rows = ["Monday", "Tuesday", "Wednesday"].map((day) => ({
      day,
      periodIndex: 4,
      startTime: "10:00:00",
      fkClassId: 8,
      fkTeacherId: 25,
      class: { label: "Grade 4" },
    }));
    rows.push({
      day: "Wednesday",
      periodIndex: 2,
      startTime: "08:40:00",
      fkClassId: 9,
      fkTeacherId: 25,
      class: { label: "Grade 2" },
    });
    const messages = timetableService.collectClashes(
      rows,
      {
        periodIndex: 2,
        startTime: "10:00",
        fkClassId: 30,
        classLabel: "Grade 1",
        fkTeacherId: 25,
        teacher: "Hassan Ali",
      },
      ["Monday", "Tuesday", "Wednesday"],
    );
    expect(messages).toEqual([
      "Hassan Ali already teaches Grade 4 at 10:00 (period 4) on Monday, Tuesday, Wednesday.",
    ]);
  });
});
