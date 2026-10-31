"use strict";

/**
 * One-off backfill that ran when student_credit_ledger was introduced: one
 * Credit row per live payment with unallocated money (source "backfill").
 * Idempotent through ON CONFLICT, so the test can run it twice.
 */
const BACKFILL_SQL = `
  INSERT INTO student_credit_ledger (
    fk_school_id, fk_student_id, entry_type, amount, source,
    fk_payment_id, notes, created_at, updated_at
  )
  SELECT
    p.fk_school_id, p.fk_student_id, 'Credit', p.unallocated_amount, 'backfill',
    p.id, 'Unallocated amount carried from receipt ' || p.receipt_no, NOW(), NOW()
  FROM fee_payments p
  WHERE p.archived_at IS NULL AND p.unallocated_amount > 0
  ON CONFLICT (fk_payment_id) WHERE source = 'backfill' DO NOTHING
`;

module.exports = { BACKFILL_SQL };
