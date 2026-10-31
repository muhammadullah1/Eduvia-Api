"use strict";

/**
 * Permission catalog (SRS Addendum v1.1, UR-01 / BR-14) — the single source of truth.
 *
 * Every protected route declares `authorize("<key>")`. On boot the catalog is synced to the
 * `permissions` table; each school's `role_permissions` start from `roles` below (today's
 * matrix) and Super Admins may edit them within `grantableTo`. Rules that must hold whatever
 * a school configures live in LOCKED_REASONS and in the services (BR-11, §9, §15.9).
 */
const { USER_ROLES } = require("./index");

const SA = USER_ROLES.SUPER_ADMIN;
const OPS = USER_ROLES.OPERATIONS_MANAGER;
const ACC = USER_ROLES.ACCOUNTANT;
const TCH = USER_ROLES.TEACHER;
const PAR = USER_ROLES.PARENT;

const RISK = { LOW: "low", MEDIUM: "medium", HIGH: "high" };

const ACTIONS = {
  VIEW: "view",
  CREATE: "create",
  EDIT: "edit",
  DELETE: "delete",
  MANAGE: "manage",
  GENERATE: "generate",
  APPROVE: "approve",
  EXPORT: "export",
  PUBLISH: "publish",
  RECORD: "record",
  REQUEST: "request",
};

/** Modules group the catalog into cards on the Roles & Permissions page. */
const PERMISSION_MODULES = [
  { key: "account", label: "Account", description: "Sign-in, own profile and school identity.", sensitive: false },
  { key: "settings", label: "Settings", description: "School profile, academic rules and fee policies.", sensitive: true },
  { key: "roles", label: "Roles & Permissions", description: "Who can do what in this school.", sensitive: true },
  { key: "staff", label: "Staff & Users", description: "Portal users, teachers and office staff.", sensitive: false },
  { key: "academic", label: "Academic Setup", description: "Sessions, classes, subjects and the curriculum.", sensitive: false },
  { key: "students", label: "Students & Admissions", description: "Applications, enrolment, parents and documents.", sensitive: false },
  { key: "attendance", label: "Attendance & Leave", description: "Daily attendance, reviews and leave requests.", sensitive: false },
  { key: "timetable", label: "Timetable & Substitutes", description: "Periods, absences and cover.", sensitive: false },
  { key: "lessons", label: "Lessons", description: "Planned chapters and daily lesson updates.", sensitive: false },
  { key: "assessments", label: "Tests & Examinations", description: "Weekly tests, exams, marks and results.", sensitive: false },
  { key: "fees", label: "Fees", description: "Monthly bills, payments, concessions and offline sync.", sensitive: true },
  { key: "finance", label: "Finance", description: "Expenses, other income and financial reports.", sensitive: true },
  { key: "communication", label: "Updates & Reports", description: "Notices, daily updates, dashboard and audit trail.", sensitive: false },
];

function permission(key, module, action, label, description, risk, roles, grantableTo = []) {
  return { key, module, action, label, description, risk, roles, grantableTo };
}

const STAFF = [OPS, ACC];

const PERMISSION_CATALOG = [
  permission("account.self", "account", ACTIONS.EDIT, "Own account", "Change own password and upload own photo.", RISK.LOW, [SA, OPS, ACC, TCH, PAR]),
  permission("school.read", "account", ACTIONS.VIEW, "School profile", "See the school name, logo and contact details.", RISK.LOW, [SA, OPS, ACC, TCH, PAR]),
  permission("school.update", "settings", ACTIONS.EDIT, "Edit school profile", "Change the school name, logo and contact details.", RISK.MEDIUM, [SA], [OPS]),
  permission("settings.read", "settings", ACTIONS.VIEW, "View settings", "Read school rules and configuration.", RISK.LOW, [SA, OPS], STAFF),
  permission("settings.academic.update", "settings", ACTIONS.EDIT, "Academic rules", "Change daily-test, attendance and admission-number rules.", RISK.MEDIUM, [SA, OPS], [OPS]),
  permission("settings.fees.update", "settings", ACTIONS.MANAGE, "Fee & result policies", "Change fee billing, concession and result-visibility policies.", RISK.HIGH, [SA]),
  permission("roles.manage", "roles", ACTIONS.MANAGE, "Manage roles", "Change role permissions and which role a staff user holds.", RISK.HIGH, [SA]),
  permission("audit.read", "communication", ACTIONS.VIEW, "Audit trail", "Read the audit trail (fee entries stay hidden without fee amounts).", RISK.MEDIUM, [SA, OPS], [OPS]),

  permission("users.read", "staff", ACTIONS.VIEW, "View staff", "See portal users and office staff.", RISK.LOW, [SA, OPS], STAFF),
  permission("users.create", "staff", ACTIONS.MANAGE, "Manage staff", "Add, edit, invite and archive teachers (Super Admin manages office staff).", RISK.HIGH, [SA, OPS], [OPS]),
  permission("teachers.read", "staff", ACTIONS.VIEW, "View teachers", "See teachers and their assignments.", RISK.LOW, [SA, OPS, TCH], STAFF),
  permission("teachers.manage", "staff", ACTIONS.EDIT, "Assign teachers", "Change teacher classes and active subject.", RISK.MEDIUM, [SA, OPS], [OPS]),
  permission("teachers.self", "staff", ACTIONS.VIEW, "Own teaching profile", "Teacher's own classes and timetable.", RISK.LOW, [TCH]),

  permission("academic.read", "academic", ACTIONS.VIEW, "View academic setup", "See sessions, classes and subjects.", RISK.LOW, [SA, OPS, ACC, TCH, PAR], STAFF),
  permission("academic.manage", "academic", ACTIONS.MANAGE, "Manage academic setup", "Create and edit sessions, classes and subjects.", RISK.MEDIUM, [SA, OPS], [OPS]),
  permission("chapters.read", "lessons", ACTIONS.VIEW, "View planned chapters", "See the planned chapters per class and subject.", RISK.LOW, [SA, OPS, TCH], [OPS]),
  permission("chapters.manage", "lessons", ACTIONS.EDIT, "Plan chapters", "Create and edit planned chapters.", RISK.MEDIUM, [SA, OPS], [OPS]),
  permission("lessons.read", "lessons", ACTIONS.VIEW, "View daily lessons", "See daily lesson updates.", RISK.LOW, [SA, OPS, TCH, PAR], [OPS]),
  permission("lessons.write", "lessons", ACTIONS.CREATE, "Write daily lessons", "Teachers submit their daily lesson update.", RISK.LOW, [TCH]),
  permission("lessons.review", "lessons", ACTIONS.APPROVE, "Review daily lessons", "Approve daily lesson updates before parents see them.", RISK.MEDIUM, [SA, OPS], [OPS]),

  permission("students.read", "students", ACTIONS.VIEW, "View students", "See student profiles and class registers.", RISK.LOW, [SA, OPS, ACC, TCH, PAR], STAFF),
  permission("students.manage", "students", ACTIONS.EDIT, "Manage students", "Edit students, promote, strike off and readmit.", RISK.MEDIUM, [SA, OPS], [OPS]),
  permission("admissions.manage", "students", ACTIONS.MANAGE, "Admissions", "Process applications and enrol students.", RISK.MEDIUM, [SA, OPS], [OPS]),
  permission("parents.manage", "students", ACTIONS.EDIT, "Manage parents", "Create and link parent accounts.", RISK.MEDIUM, [SA, OPS], [OPS]),
  permission("documents.read", "students", ACTIONS.VIEW, "View documents", "Open admission documents.", RISK.LOW, [SA, OPS, PAR], [OPS]),
  permission("families.read", "students", ACTIONS.VIEW, "View families", "See archived family links (read-only history).", RISK.LOW, [SA, OPS, ACC], STAFF),
  permission("families.manage", "students", ACTIONS.EDIT, "Manage families", "Families are archived; writes are closed.", RISK.LOW, [SA, OPS], [OPS]),

  permission("attendance.read", "attendance", ACTIONS.VIEW, "View attendance", "See attendance registers and insight.", RISK.LOW, [SA, OPS, TCH, PAR], [OPS]),
  permission("attendance.mark", "attendance", ACTIONS.CREATE, "Mark attendance", "Mark daily attendance.", RISK.MEDIUM, [SA, OPS, TCH], [OPS]),
  permission("attendance.review", "attendance", ACTIONS.APPROVE, "Review attendance", "Review attendance changes and reminders.", RISK.MEDIUM, [SA, OPS], [OPS]),
  permission("attendance.edit", "attendance", ACTIONS.EDIT, "Correct attendance", "Edit saved attendance within the edit window.", RISK.MEDIUM, [SA, OPS], [OPS]),
  permission("leave.read", "attendance", ACTIONS.VIEW, "View leave", "See leave requests.", RISK.LOW, [SA, OPS, TCH, PAR], [OPS]),
  permission("leave.request", "attendance", ACTIONS.REQUEST, "Request leave", "Submit a student leave request.", RISK.LOW, [SA, OPS, PAR], [OPS]),
  permission("leave.review", "attendance", ACTIONS.APPROVE, "Review leave", "Approve or reject leave requests.", RISK.MEDIUM, [SA, OPS], [OPS]),

  permission("timetable.read", "timetable", ACTIONS.VIEW, "View timetable", "See class and teacher timetables.", RISK.LOW, [SA, OPS, TCH, PAR], STAFF),
  permission("timetable.manage", "timetable", ACTIONS.EDIT, "Edit timetable", "Create and change periods.", RISK.MEDIUM, [SA, OPS], [OPS]),
  permission("absences.read", "timetable", ACTIONS.VIEW, "View absences", "See teacher absences and cover.", RISK.LOW, [SA, OPS, TCH], [OPS]),
  permission("absences.manage", "timetable", ACTIONS.MANAGE, "Assign substitutes", "Mark teachers absent and assign cover.", RISK.MEDIUM, [SA, OPS], [OPS]),

  permission("tests.read", "assessments", ACTIONS.VIEW, "View weekly tests", "See test schedules and published marks.", RISK.LOW, [SA, OPS, TCH, PAR], [OPS]),
  permission("tests.schedule", "assessments", ACTIONS.CREATE, "Schedule tests", "Plan weekly test days.", RISK.MEDIUM, [SA, OPS], [OPS]),
  permission("tests.marks", "assessments", ACTIONS.EDIT, "Enter test marks", "Enter weekly test marks.", RISK.MEDIUM, [SA, OPS, TCH], [OPS]),
  permission("tests.publish", "assessments", ACTIONS.PUBLISH, "Publish tests", "Publish weekly test marks to parents.", RISK.MEDIUM, [SA, OPS], [OPS]),
  permission("exams.read", "assessments", ACTIONS.VIEW, "View exams", "See examinations and mark sheets.", RISK.LOW, [SA, OPS, TCH, PAR], [OPS]),
  permission("exams.create", "assessments", ACTIONS.CREATE, "Create exams", "Set up examinations and papers.", RISK.MEDIUM, [SA, OPS], [OPS]),
  permission("exams.marks", "assessments", ACTIONS.EDIT, "Enter exam marks", "Enter and submit exam marks.", RISK.MEDIUM, [SA, OPS, TCH], [OPS]),
  permission("exams.verify", "assessments", ACTIONS.APPROVE, "Verify marks", "Verify submitted mark sheets.", RISK.MEDIUM, [SA, OPS], [OPS]),
  permission("exams.publish", "assessments", ACTIONS.PUBLISH, "Publish results", "Publish exam results.", RISK.HIGH, [SA, OPS], [OPS]),
  permission("results.override", "assessments", ACTIONS.APPROVE, "Result visibility override", "Let a parent see a result despite the fee rule (audited).", RISK.HIGH, [SA, OPS], [OPS]),
  permission("results.parent", "assessments", ACTIONS.VIEW, "Child's results", "Parent sees published results when the fee rule passes.", RISK.LOW, [PAR]),

  permission("fees.months.read", "fees", ACTIONS.VIEW, "View monthly bills", "See generated monthly bills.", RISK.MEDIUM, [SA, ACC, PAR], [ACC]),
  permission("fees.months.generate", "fees", ACTIONS.GENERATE, "Generate monthly bills", "Run the monthly bill generation.", RISK.HIGH, [SA, ACC], [ACC]),
  permission("fees.months.adjust", "fees", ACTIONS.EDIT, "Adjust bills", "Post audited adjustments to generated bills.", RISK.HIGH, [SA]),
  permission("fees.payments.read", "fees", ACTIONS.VIEW, "View payments", "See payments and receipts.", RISK.MEDIUM, [SA, ACC, PAR], [ACC]),
  permission("fees.payments.record", "fees", ACTIONS.RECORD, "Collect fee", "Record a payment and print the receipt.", RISK.HIGH, [SA, ACC], [ACC]),
  permission("fees.payments.confirm", "fees", ACTIONS.APPROVE, "Confirm payments", "Confirm pending payments.", RISK.HIGH, [SA]),
  permission("fees.payments.allocate_manual", "fees", ACTIONS.EDIT, "Manual allocation", "Allocate a payment to chosen months instead of oldest-first.", RISK.HIGH, [SA]),
  permission("fees.collections.mine", "fees", ACTIONS.VIEW, "My daily receipts", "Own receipts only, without totals.", RISK.MEDIUM, [ACC], [ACC]),
  permission("fees.totals", "fees", ACTIONS.VIEW, "Fee totals", "Overall collection totals and aggregates.", RISK.HIGH, [SA]),
  permission("fees.amounts.read", "fees", ACTIONS.VIEW, "Fee amounts", "See fee amounts inside non-fee screens.", RISK.MEDIUM, [SA, ACC, PAR], [ACC]),
  permission("fees.reports", "fees", ACTIONS.EXPORT, "Fee reports", "Fee reports (the accountant only gets own rows, no totals).", RISK.HIGH, [SA, ACC], [ACC]),
  permission("fees.structure.read", "fees", ACTIONS.VIEW, "View fee structure", "See class fee structures.", RISK.MEDIUM, [SA, ACC], [ACC]),
  permission("fees.structure.update", "fees", ACTIONS.EDIT, "Edit fee structure", "Change class fee structures.", RISK.HIGH, [SA]),
  permission("fees.credit.read", "fees", ACTIONS.VIEW, "View credit", "See student credit balances.", RISK.MEDIUM, [SA, ACC, PAR], [ACC]),
  permission("fees.import", "fees", ACTIONS.CREATE, "Offline sync", "Import fee workbooks and see own upload history.", RISK.HIGH, [SA, ACC], [ACC]),
  permission("fees.concessions.read", "fees", ACTIONS.VIEW, "View concessions", "See student concessions.", RISK.MEDIUM, [SA, ACC, PAR], [ACC]),
  permission("fees.concessions.request", "fees", ACTIONS.REQUEST, "Request concessions", "Assign or request a student concession.", RISK.HIGH, [SA, ACC], [ACC]),
  permission("fees.concessions.approve", "fees", ACTIONS.APPROVE, "Approve concessions", "Approve or reject concessions.", RISK.HIGH, [SA]),

  permission("expenses.read", "finance", ACTIONS.VIEW, "View expenses", "Accountant sees only own entries, without totals.", RISK.MEDIUM, [SA, ACC], [ACC]),
  permission("expenses.create", "finance", ACTIONS.CREATE, "Record expenses", "Record a school expense.", RISK.HIGH, [SA, ACC], [ACC]),
  permission("expenses.manage", "finance", ACTIONS.EDIT, "Manage expenses", "Edit and void any expense.", RISK.HIGH, [SA]),
  permission("income.read", "finance", ACTIONS.VIEW, "View income", "See other income.", RISK.HIGH, [SA]),
  permission("income.create", "finance", ACTIONS.CREATE, "Record income", "Record other income.", RISK.HIGH, [SA]),
  permission("income.manage", "finance", ACTIONS.EDIT, "Manage income", "Edit and void other income.", RISK.HIGH, [SA]),
  permission("finance.reports", "finance", ACTIONS.EXPORT, "Finance reports", "Income, expenses and the operating position.", RISK.HIGH, [SA]),

  permission("updates.read", "communication", ACTIONS.VIEW, "View updates", "Read approved notices and updates.", RISK.LOW, [SA, OPS, ACC, TCH, PAR], STAFF),
  permission("updates.write", "communication", ACTIONS.CREATE, "Write updates", "Draft notices and class updates.", RISK.LOW, [SA, OPS, TCH], [OPS]),
  permission("updates.review", "communication", ACTIONS.APPROVE, "Review updates", "Approve notices before parents see them.", RISK.MEDIUM, [SA, OPS], [OPS]),
  permission("reports.dashboard", "communication", ACTIONS.VIEW, "Dashboard", "Dashboard figures (fee totals need Fee totals).", RISK.LOW, [SA, OPS, TCH, PAR], STAFF),
];

/** Keys every role keeps: without them nobody can sign in or see their school. */
const ALWAYS_GRANTED = new Set(["account.self", "school.read"]);

/** Why a key cannot be granted to a role that is not in its `roles`/`grantableTo` (SRS invariants). */
const LOCKED_REASONS = {
  "settings.fees.update": "Fee and result policies are Super Admin only (SRS §15.9).",
  "roles.manage": "Only the Super Admin manages roles.",
  "fees.totals": "Overall fee totals are Super Admin only (SRS §15.9, BR-11).",
  "fees.payments.allocate_manual": "Manual allocation is a Super Admin financial control.",
  "fees.payments.confirm": "Confirming payments is a Super Admin financial control.",
  "fees.months.adjust": "Bill adjustments are a Super Admin financial control.",
  "fees.structure.update": "Fee amounts are set by the Super Admin only.",
  "fees.concessions.approve": "Approving concessions is a Super Admin financial control.",
  "expenses.manage": "Editing any expense is a Super Admin financial control.",
  "income.read": "Income is Super Admin only (SRS §15.9).",
  "income.create": "Income is Super Admin only (SRS §15.9).",
  "income.manage": "Income is Super Admin only (SRS §15.9).",
  "finance.reports": "Finance reports are Super Admin only (SRS §15.9).",
};

const ROLE_LOCK_REASONS = {
  [OPS]: "Operations Managers see fee status only (cleared yes/no), never amounts or financial controls.",
  [TCH]: "Teachers keep their own portal: no fee access and no management controls.",
  [PAR]: "Parents are read-only and see only their own children.",
  [ACC]: "Not part of the accountant's collection role.",
};

const SUPER_ADMIN_REASON = "Super Admin always holds every permission.";
const SELF_SERVICE_REASON = "Belongs to another portal's own user (their own lessons, child or receipts).";
const ALWAYS_GRANTED_REASON = "Every user needs this to sign in.";

const CATALOG_BY_KEY = new Map(PERMISSION_CATALOG.map((entry) => [entry.key, entry]));
const ALL_PERMISSION_KEYS = PERMISSION_CATALOG.map((entry) => entry.key);

function isKnownPermission(key) {
  return CATALOG_BY_KEY.has(key);
}

function assertKnownPermission(key) {
  if (!isKnownPermission(key)) throw new Error(`Unknown permission "${key}"`);
  return CATALOG_BY_KEY.get(key);
}

/**
 * Today's matrix for a system role (the seed and "Reset to default"). For the Super Admin this is
 * every staff permission; the few self-service keys of other portals (a teacher's own lessons, a
 * parent's own child, an accountant's own receipts) describe that user, not a capability.
 */
function defaultPermissionsFor(roleKey) {
  return PERMISSION_CATALOG.filter((entry) => entry.roles.includes(roleKey)).map((entry) => entry.key);
}

/** Null when the role may hold or drop this key; otherwise the reason it is locked. */
function lockReasonFor(roleKey, key) {
  const entry = assertKnownPermission(key);
  if (roleKey === SA && entry.roles.includes(SA)) return SUPER_ADMIN_REASON;
  if (roleKey === SA) return SELF_SERVICE_REASON;
  if (ALWAYS_GRANTED.has(key)) return ALWAYS_GRANTED_REASON;
  if (entry.roles.includes(roleKey) || entry.grantableTo.includes(roleKey)) return null;
  return LOCKED_REASONS[key] || ROLE_LOCK_REASONS[roleKey] || SUPER_ADMIN_REASON;
}

/** True when `key` may be granted to `roleKey` (it is not merely kept). */
function isGrantable(roleKey, key) {
  return lockReasonFor(roleKey, key) === null;
}

/**
 * What a role really holds given its stored grants: the Super Admin always has its full set,
 * sign-in keys are always on, and a stored grant outside the role's grantable set is ignored.
 */
function effectivePermissions(roleKey, storedKeys) {
  const defaults = defaultPermissionsFor(roleKey);
  if (roleKey === SA) return defaults;
  const kept = storedKeys.filter((key) => isKnownPermission(key) && isGrantable(roleKey, key));
  const always = defaults.filter((key) => ALWAYS_GRANTED.has(key));
  return [...new Set([...always, ...kept])];
}

module.exports = {
  ACTIONS,
  RISK,
  PERMISSION_MODULES,
  PERMISSION_CATALOG,
  ALL_PERMISSION_KEYS,
  ALWAYS_GRANTED,
  isKnownPermission,
  assertKnownPermission,
  defaultPermissionsFor,
  lockReasonFor,
  isGrantable,
  effectivePermissions,
};
