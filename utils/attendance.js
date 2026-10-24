"use strict";

/**
 * The one attendance-percentage rule (EDUVIA-14 decision 2): Present and Late
 * count as attended; Leave (and Excused) days are excluded from the
 * denominator. Returns null when no countable day exists (e.g. all leave),
 * so callers never divide by zero. One decimal place.
 */
const attendancePercent = ({ present = 0, late = 0, absent = 0 } = {}) => {
  const counted = present + late + absent;
  return counted ? Math.round(((present + late) / counted) * 1000) / 10 : null;
};

module.exports = { attendancePercent };
