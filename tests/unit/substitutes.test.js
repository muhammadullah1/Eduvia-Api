"use strict";

const { availableTeachers } = require("../../utils/substitutes");

describe("substitute availability (UR-03 / BR-03/04)", () => {
  const teachers = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }];

  test("excludes the absent teacher, anyone timetabled, substituting or absent then", () => {
    const free = availableTeachers(
      teachers,
      {
        slots: [{ fkTeacherId: 2 }],
        substitutions: [{ fkSubstituteTeacherId: 3 }],
        absences: [{ fkTeacherId: 1 }, { fkTeacherId: 4 }],
      },
      1,
    );
    expect(free.map((t) => t.id)).toEqual([5]);
  });
});
