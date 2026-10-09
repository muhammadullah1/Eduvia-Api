"use strict";

/**
 * Pure availability rule for substitutes (UR-03 / BR-03/04): a teacher is free
 * at weekday+period when they have no timetable slot then, no substitution
 * already on that date+period, and are not themselves absent then.
 */
function busyTeacherIds({ slots = [], substitutions = [], absences = [] }) {
  const busy = new Set();
  for (const slot of slots) if (slot.fkTeacherId) busy.add(slot.fkTeacherId);
  for (const sub of substitutions) busy.add(sub.fkSubstituteTeacherId);
  for (const absence of absences) busy.add(absence.fkTeacherId);
  return busy;
}

function availableTeachers(teachers, context, excludeTeacherId) {
  const busy = busyTeacherIds(context);
  return teachers.filter((t) => t.id !== excludeTeacherId && !busy.has(t.id));
}

module.exports = { busyTeacherIds, availableTeachers };
