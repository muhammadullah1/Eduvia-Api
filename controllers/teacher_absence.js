"use strict";

const { teacherAbsenceService } = require("../services");
const { handle } = require("../utils/handler");

module.exports = {
  list: handle("Teacher absences", (req) => teacherAbsenceService.list(req.user.schoolId, req.query, req.user)),
  markAbsent: handle("Absence recorded", (req) => teacherAbsenceService.markAbsent(req.user, req.body), 201),
  availableSubstitutes: handle("Available substitutes", (req) =>
    teacherAbsenceService.availableSubstitutes(req.user.schoolId, req.params.id),
  ),
  assignSubstitute: handle("Substitute assigned", (req) => teacherAbsenceService.assignSubstitute(req.user, req.params.id, req.body)),
  removeSubstitute: handle("Substitute removed", (req) => teacherAbsenceService.removeSubstitute(req.user, req.params.id)),
  cancel: handle("Absence cancelled", (req) => teacherAbsenceService.cancel(req.user, req.params.id)),
};
