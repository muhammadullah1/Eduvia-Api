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
});
