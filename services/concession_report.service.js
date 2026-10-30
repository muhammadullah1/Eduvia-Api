"use strict";

const { QueryTypes } = require("sequelize");
const { sequelize } = require("../models");
const ApiError = require("../utils/ApiError");

/**
 * Concessions given — reconciles bill snapshots (immutable) with active rows.
 * Always scoped to the actor's school.
 */
async function report(schoolId, { month, classId, reasonId } = {}) {
  if (!schoolId) throw new ApiError(400, "School is required");

  const params = { schoolId };
  let monthFilter = "";
  let classFilter = "";
  let reasonFilter = "";

  if (month) {
    monthFilter = "AND m.month = :month";
    params.month = month;
  }
  if (classId) {
    classFilter = "AND s.fk_class_id = :classId";
    params.classId = Number(classId);
  }
  if (reasonId) {
    reasonFilter = "AND (m.concession_snapshot->>'reasonLabel') IS NOT NULL";
    params.reasonId = Number(reasonId);
  }

  const byReason = await sequelize.query(
    `
    SELECT COALESCE(m.concession_snapshot->>'reasonLabel', '(none)') AS reason,
           COUNT(*)::int AS bills,
           COALESCE(SUM((m.concession_snapshot->>'discount')::numeric), 0)::float AS discount_total,
           COALESCE(SUM(m.base_amount), 0)::float AS base_total,
           COALESCE(SUM(m.net_amount), 0)::float AS net_total
      FROM student_fee_months m
      JOIN students s ON s.id = m.fk_student_id
     WHERE m.fk_school_id = :schoolId
       AND m.archived_at IS NULL
       AND m.concession_snapshot IS NOT NULL
       AND COALESCE((m.concession_snapshot->>'discount')::numeric, 0) > 0
       ${monthFilter}
       ${classFilter}
     GROUP BY 1
     ORDER BY discount_total DESC
    `,
    { replacements: params, type: QueryTypes.SELECT },
  );

  const byClass = await sequelize.query(
    `
    SELECT COALESCE(c.label, 'Unassigned') AS class_label,
           c.id AS class_id,
           COUNT(*)::int AS bills,
           COALESCE(SUM((m.concession_snapshot->>'discount')::numeric), 0)::float AS discount_total
      FROM student_fee_months m
      JOIN students s ON s.id = m.fk_student_id
      LEFT JOIN classes c ON c.id = s.fk_class_id
     WHERE m.fk_school_id = :schoolId
       AND m.archived_at IS NULL
       AND m.concession_snapshot IS NOT NULL
       AND COALESCE((m.concession_snapshot->>'discount')::numeric, 0) > 0
       ${monthFilter}
       ${classFilter}
     GROUP BY c.id, c.label
     ORDER BY discount_total DESC
    `,
    { replacements: params, type: QueryTypes.SELECT },
  );

  const byMonth = await sequelize.query(
    `
    SELECT m.month,
           COUNT(*)::int AS bills,
           COALESCE(SUM((m.concession_snapshot->>'discount')::numeric), 0)::float AS discount_total
      FROM student_fee_months m
      JOIN students s ON s.id = m.fk_student_id
     WHERE m.fk_school_id = :schoolId
       AND m.archived_at IS NULL
       AND m.concession_snapshot IS NOT NULL
       AND COALESCE((m.concession_snapshot->>'discount')::numeric, 0) > 0
       ${monthFilter}
       ${classFilter}
     GROUP BY m.month
     ORDER BY m.month DESC
    `,
    { replacements: params, type: QueryTypes.SELECT },
  );

  const active = await sequelize.query(
    `
    SELECT COUNT(*)::int AS approved_active
      FROM student_fee_concessions
     WHERE fk_school_id = :schoolId
       AND status = 'Approved'
       AND archived_at IS NULL
    `,
    { replacements: { schoolId }, type: QueryTypes.SELECT },
  );

  void reasonId;
  void reasonFilter;

  return {
    schoolId,
    filters: { month: month || null, classId: classId ? Number(classId) : null },
    approvedActive: active[0] ? active[0].approved_active : 0,
    byReason,
    byClass,
    byMonth,
  };
}

module.exports = { report };
