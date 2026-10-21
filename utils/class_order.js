"use strict";

/**
 * School order for classes: Playgroup/Nursery, KG, Prep, then Grade 1, 2 … 12,
 * then section. Alphabetical sorting put "Grade 10" before "Grade 2" and KG
 * after every grade.
 */
const EARLY_YEARS = [
  [/^(play\s*group|pg)$/i, 0],
  [/^nursery$/i, 1],
  [/^(kg|k\.?g\.?|kindergarten)$/i, 2],
  [/^prep$/i, 3],
];

function classRankKey(klass) {
  const grade = String((klass && (klass.grade || klass.label)) || "").trim();
  for (const [pattern, rank] of EARLY_YEARS) {
    if (pattern.test(grade)) return [rank, 0];
  }
  const numbered = /(\d+)/.exec(grade);
  if (numbered) return [10, Number(numbered[1])];
  return [100, 0];
}

function compareClasses(a, b) {
  const [ra, na] = classRankKey(a);
  const [rb, nb] = classRankKey(b);
  if (ra !== rb) return ra - rb;
  if (na !== nb) return na - nb;
  const ga = String(a.grade || a.label || "");
  const gb = String(b.grade || b.label || "");
  if (ga !== gb) return ga.localeCompare(gb);
  return String(a.section || "").localeCompare(String(b.section || ""));
}

function sortClasses(classes) {
  return [...classes].sort(compareClasses);
}

module.exports = { classRankKey, compareClasses, sortClasses };
