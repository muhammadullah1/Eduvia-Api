# Software Requirements Specification — School Management System

Prepared for Creative Leaders School by Abler Software Solutions.

| | |
|---|---|
| Document | Unified SRS v1.1 |
| Baseline | Version 1.0, 20 September 2026 |
| Addendum | Updated requirements, 28 September 2026 |
| Source PDF | `Creative_Leaders_School_Unified_SRS_Abler_v1.1.pdf` |
| Product | One school system delivered in three phases |

This markdown is the working copy of that PDF. Wording is normalized for development. Requirement ids, business-rule ids, and open questions are preserved. It is not a second specification.

## Document control

The baseline remains in force for every feature the addendum does not change. Where the addendum is more specific, or the two conflict, the addendum is the development rule.

The consolidated scope is:

- The original three-phase school system.
- Updated roles and permissions.
- One teacher, one active subject.
- Absent-teacher substitute management.
- Planned chapters and daily lesson tracking.
- Weekly subject tests and monthly failure flagging.
- Fee-based examination-result visibility, with an authorized override.
- Accountant fee-collection restrictions.
- Oldest-unpaid-first fee allocation in the parent portal.

## 1. Purpose and vision

The system is for school management, office staff, teachers, and parents. Each feature is defined by who uses it, what they can do, and what the school gets.

One connected system:

- Management controls records and operations from one place.
- Teachers run daily academic work in a private workspace: attendance, lesson progress, marks, updates.
- Parents see their own child's attendance, results, fees, and updates without calling the school.

Phases share the same students, academics, examinations, and fees. Data is entered once.

Phase 2 and Phase 3 are additions. The original internal SRS did not include attendance or a parent portal. Those arrive in the later phases. Phase 1 remains the foundation. If Phase 1 master data is wrong, later phases cannot work.

## 2. Phased roadmap

| Phase | Users | Purpose | Main capabilities |
|---|---|---|---|
| 1 — Internal management | Admin, management, office staff | Core records and daily operations | Dashboard, academic setup, admissions, student lifecycle, exams, fees, finance, reports, offline fee sync |
| 2 — Teacher portal | Teachers | Focused workspace for assigned classes | Dashboard, timetable, classes, attendance, lesson progress, daily updates, marks |
| 3 — Parent portal | Parents and guardians | Read-only view of their own children | Child dashboard, attendance, results, fees, timetable, progress, updates, documents |

Delivery order: Internal management, then Teacher portal, then Parent portal. Each phase can go live on its own cycle.

Core principle: approved school data flows management → teacher → parent. A student's attendance is recorded once by the teacher, reviewed by management, and viewed by the parent.

## 3. Users and access

Baseline roles. The addendum in section 15 replaces the Admin / office / exam-staff split where they conflict. Teacher and Parent stay as defined here.

| Role | Responsibility | Access |
|---|---|---|
| Admin / Management | Full control of setup, records, reports, configuration | All modules and settings |
| Office / Admission / Fee staff | Admissions, student records, fee collection, as assigned | Operational modules only. No exam finalization or system settings unless granted |
| Exam staff | Exam setup, marks workflow, examination reports | Examination module only. No finance or admissions unless granted |
| Teacher | Assigned classes: attendance, progress, daily updates, assigned marks | Teacher portal only. No other teachers' classes, no fees, no management reports |
| Parent / Guardian | View linked children | Parent portal only. Read-only. No other students. No edits |

## 4. Phase 1 — Internal management

Academic chain:

`Academic session → Classes → Subjects → Teachers → Timetable`

Student journey:

`Admission → Enrollment → Examination → Result → DMC`

### 4.1 Dashboard

First screen after login. Every figure is calculated from data entered elsewhere. The dashboard does not create or store its own totals.

**Academic summary:** current session, total classes, total subjects, teachers with a teaching assignment.

**Student summary:** total students ever, active, inactive (temporarily not attending), new admissions this session, graduated, struck-off.

**Examination summary:** upcoming exams, recent finalized results, pending marks, overall performance (pass rate or average).

**Fee summary:** current-month collection, paid value, unpaid value, outstanding owed, advance held as credit.

**Finance summary:** total income (fees plus other income), total expenses (staff plus other), current financial status (income minus expenses).

**Graphs:**

1. Student distribution by class.
2. Student admission trend.
3. Monthly fee collection.
4. Paid vs unpaid fees.
5. Income vs expenses.
6. Examination performance by class.

### 4.2 Academic management

Defines the session, subjects, classes, teachers, and timetable. Students, exams, and fees refer back to this structure.

#### 4.2.1 Academic session

One school year, for example `2026–2027`. It is the time boundary for classes, subjects, students, exams, and fees.

- Create: name, start date, end date.
- Edit: name or dates before or while the session is in use.
- Activate: exactly one current session. New admissions, fee generation, and exams belong to it.
- List: past and current sessions, sorted by start date.

Open: whether two sessions may be active at once. This SRS assumes one current session.

#### 4.2.2 Subjects

Courses such as Mathematics or English. A subject is taught in a class. A teacher is assigned to teach it.

- Create: name, and a code if the school uses one.
- Edit name or details.
- Assign the same subject to many classes.
- Deactivate without deleting history. Old exams and marks stay visible.

Open: the same subject taught by different teachers in different classes. This SRS assumes yes.

#### 4.2.3 Classes

A group of students in one session, for example Class 5.

- Create a class for the current session.
- Edit name or status.
- Assign the subjects taught in the class.
- Enroll students during admission or promotion.

Open: sections such as Class 5-A and 5-B. The baseline does not include sections unless confirmed.

#### 4.2.4 Teachers

Teaching identity only. Not HR and not payroll.

- Create a teacher with a name and a small identifier (phone or staff id) so dropdowns stay unambiguous.
- Teaching assignment is Teacher + Subject + Class. Timetable and marks entry depend on it.

The addendum narrows this: one active subject per teacher. See section 15.3. Class assignments still exist.

#### 4.2.5 Timetable

When each teacher teaches each subject to each class.

- Create a period: class, subject, teacher, weekday, start time, end time.
- Block two conflicts:
  - the same teacher in two classes at the same day and time;
  - the same class with two subjects at the same day and time.
- View the week by class or by teacher.

Open: strict block versus warn. Substitutes are specified separately in the addendum and are not a reason to allow a double booking.

### 4.3 Student management

From application through promotion, graduation, or exit.

#### 4.3.1 Admission

An application is not a student until every step is complete:

`Student details → Guardian details → Documents → Interview / test → Decision → Enrollment`

**Student details:** name, date of birth, gender, contact, address, previous school and last class, system-generated admission or registration number, photograph.

Open: which of these fields are mandatory. The baseline does not assume any field is mandatory.

**Guardian details:** name, relationship (father, mother, guardian, or similar), contact, address.

Open: more than one guardian, including an emergency contact.

**Documents:** upload, view, replace, verify. Each document is Pending, Uploaded, or Verified.

Open: which documents are required (birth certificate, previous school leaving certificate, guardian id, photographs, medical record) and which are mandatory.

**Interview / test:** schedule date and type (interview, written test, or both); record performance and score; result Pass/Fail or Recommended/Not Recommended; remarks; decision Admit, Reject, or Waitlist.

Open: whether the interview is mandatory, and whether there is a minimum score.

**Enrollment:** once approved, place the applicant in a class for a session. Record class, session, enrollment date, and status Enrolled, Pending, or Withdrawn. This step creates the active student.

#### 4.3.2 Student profile

**Personal:** the admission details, editable by authorized users as they change.

**Academic:** current class and session, previous academic information, promotion history, examination history.

**Finance (read-only, from fees):** month-by-month fee records, payments, outstanding, advance credit, chronological transactions.

#### 4.3.3 Lifecycle

**Promotion.** Move to the next class, usually at a new session. Record previous class, new class, session, and date. History is permanent.

Open: bulk promotion of a whole class. Not requested. Do not treat it as in scope.

**Activation.** Active students are in counts, class lists, and fee generation. Inactive students are temporarily away (for example on leave): kept on record, dropped from active counts. Every status change needs a reason and a date, and is kept in history.

**Graduation.** Schooling complete. Record graduation date, final class, session, and final result. Excluded from active counts. History remains.

**Struck off.** Enrollment ended for long absence, discipline, or policy. Record date, reason, academic status, and financial status including outstanding fees. History remains.

### 4.4 Examinations

Schedule, enter marks, calculate results, rank, and produce documents.

#### 4.4.1 Schedule

- Name or type, for example Mid-Term, Final Term, Monthly Test.
- Session, class, and subject.
- Date, start time, end time.
- Total marks and passing marks.

Open: the school's official exam names; whether passing marks are required on every paper; whether passing marks differ by subject.

#### 4.4.2 Marks entry

Class-wise. One screen for every student in the class and subject.

`Select exam → Select class → Select subject → Enter marks → Validate → Save as draft → Submit (final)`

- Marks are not negative and do not exceed the maximum.
- Draft remains editable.
- Submit locks casual editing and feeds the result.

Open: who may enter marks (subject teacher, exam staff, or both). Whether a submitted sheet needs a separate reopen step. The addendum and the portals assume the subject teacher enters marks and management controls later states.

#### 4.4.3 Results and ranking

When all subject marks for a student are submitted:

- Total marks, obtained marks, percentage (obtained ÷ total × 100).
- Grade from the school scale, if used.
- Pass or fail against passing marks.

| Rank | Meaning | Where it appears |
|---|---|---|
| Class rank | Position among classmates for one exam | DMC, class result |
| Subject rank | Position in one subject among classmates | Subject result |
| Overall rank | Combined position across subjects in one exam | DMC, class result |
| Exam rank | School-wide position for the exam | Overall examination report |

Open: ties. Shared rank (both rank 3, next is rank 5) versus a tie-break. Not decided.

#### 4.4.4 Documents

From finalized results, preview on screen and download as PDF:

- DMC: subject-wise marks, total, percentage, grade, rank.
- Result sheet: pass/fail summary.
- Mark sheet: raw marks for a class and subject.
- Class result report: every student, with result and rank.
- Overall examination report: school-wide outcome.

### 4.5 Fee management

What each class is charged, each student's monthly record, and the payments against it.

#### 4.5.1 Fee structure

- One class amount applies to students in that class.
- Fee type label, for example Tuition Fee.
- Defined per academic session so amounts can change by year.
- Effective date so a mid-year change is possible.

Open: one combined monthly fee, or separate types (tuition, admission, exam, miscellaneous).

#### 4.5.2 Monthly generation

- One record per student per month, with the amount due.
- Previous outstanding carried forward.
- Status maintained as Unpaid, Partially Paid, Paid, or Advance.
- A month-by-month ledger per student.

#### 4.5.3 Payment scenarios

Exactly four:

| Scenario | Meaning |
|---|---|
| Per month | One month paid in one payment |
| Multiple months | Several months paid together |
| Advance | Paid before due, creating credit for later months |
| Unpaid | No payment; the month stays outstanding |

Each payment stores amount, date, months covered, status, remaining amount, and advance amount, and issues a printable receipt.

Open in the baseline: auto-apply advance to the next due months, or hold a general credit for staff to apply. The addendum resolves ordinary payments: oldest unpaid month first. See section 15.10.

#### 4.5.4 Collection reports

Daily collection, monthly collection, class-wise, student-wise, and lists or totals for paid, unpaid, outstanding, and advance.

The addendum restricts who may see totals. See section 15.2 and 15.9.

### 4.6 Finance

Money in and money out. Fee income plus other income. Staff expenses plus other expenses.

**Income**

- Fee income is created from fee payments. Staff do not type it again.
- Other income is entered manually (donations, miscellaneous), with category, amount, date, description, and a reference back to the source.

**Expenses**

- Staff expenses (for example salary) are a financial expense only. This is not payroll.
- Other expenses (utilities, supplies, maintenance) use the same shape: category, amount, date, description, optional reference such as an invoice number.

**Report**

- Total income = fee income + other income for the period.
- Total expenses = staff expenses + other expenses.
- Net = income − expenses.

Graphs: income vs expenses over time, income breakdown, expense breakdown, net trend.

Open: whether payment method (cash, bank transfer, cheque) is stored on income and expenses.

### 4.7 Offline fee submission and sync

Staff record payments in Excel when the network is down, then import without duplicates.

`Download template → Enter offline → Save file → Connection returns → Validate and sync → Database updated`

**Template columns:** student id or admission number; student name (display only, not used to match); class; month or months; amount; payment date; receipt or reference number; payment method; notes.

**While offline**

- Receipt or reference number is unique per row.
- Student id must already exist.
- Month is a recognized period, for example `2026-09`.
- Amount is a positive number.

**Validation before any write**

| Check | Action |
|---|---|
| Student exists | Id matches an enrolled student |
| Fee period valid | Month is a real fee period for that student's class |
| Amount valid | Positive and not zero |
| Duplicate | Same receipt or reference already imported → skip the row |
| Required fields | Empty mandatory field fails the row |

Valid rows post, update balances and statuses, and generate receipts. Invalid rows are listed with a reason. They are not dropped quietly.

**Summary:** successful count, skipped count, failed count with a downloadable error list, and the sync timestamp.

Safety rule: the same payment is never imported twice. Re-running the same file is safe. The receipt or reference number is the unique key.

Automatic sync when a connection and a saved file are both detected is allowed. Staff are told when it starts and when it finishes.

## 5. Phase 2 — Teacher portal

Teachers see only assigned classes, subjects, and information. No management controls, no fee details, no other teachers' classes.

The portal answers: What do I teach today? Who is present? What have I covered? What needs attention?

### 5.1 Dashboard

- Today's timetable: period, time, class, subject.
- Upcoming classes.
- Assigned classes and subjects, with student counts.
- Attendance completed vs pending for today.
- Recent lesson progress and pending lesson entries.
- Pending marks and upcoming exam tasks.
- The teacher's own recent updates, plus school messages relevant to teachers.

Quick actions: take attendance, record a lesson update, enter marks, view my classes.

### 5.2 My classes

List of assigned classes with subject and student count. Opening a class shows:

- Roster: name, admission number, contact.
- Attendance history and per-student percentages.
- Exam schedule, marks, and results for the teacher's subject.
- Recent lesson progress and the teacher's daily updates.

### 5.3 Attendance

- Pick an assigned class and a date. The full roster is shown.
- Mark each student: Present, Absent, Late, or another status the school configures (for example On Leave or Excused).
- Saved attendance is visible to management immediately, and to parents in Phase 3.
- Edits are allowed only inside a school-configured window (same day or same week are the examples). Every change is historied.
- Summaries: daily, weekly, monthly, student percentage, class percentage.

### 5.4 Lesson and academic progress

- Class, subject, and date.
- Topic taught, and progress against the planned curriculum.
- Classwork, homework, and short remarks about the class or a student.
- The teacher sees their own earlier entries. Management can review every teacher's progress.

The addendum makes planned chapters explicit. See section 15.6.

### 5.5 Daily updates

Short dated class-diary notes: topic, activity, homework or classwork, issues. Each update is tied to a class, subject, and date. Management can review them. Parents see them in Phase 3 only when the school has approved that update for parents.

### 5.6 Exams and marks

- See exams assigned through the teaching assignment.
- Enter class-wise marks, save draft, submit.
- After submit, casual edits stop. Re-editing needs management.
- See which exams are submitted and which are pending.

Teacher loop: `Login → Dashboard → Today's class → Attendance → Lesson / update → Marks → Review`

## 6. Phase 3 — Parent portal

Read-only, plain language, linked children only. If there are several children, the parent switches child. Each child's data stays separate.

Loop: `Login → Select child → Dashboard → Attendance → Results → Fees → Updates / timetable`

### 6.1 Dashboard

- Child name, class, session.
- Recent attendance and the month and session percentages. Optional absence alerts.
- Latest exam: subject marks, total, percentage, grade, class rank and overall rank if the school publishes ranks.
- Current monthly fee, due date, status (Paid, Partially Paid, Unpaid, outstanding, advance). Outstanding is highlighted.
- Latest teacher updates, homework and classwork when enabled.
- Class timetable, upcoming exams, school notices.

### 6.2 Profile

Parent-approved fields only: name, date of birth, class, session, optional promotion timeline, approved teacher remarks.

### 6.3 Attendance

Daily history for the session, monthly summary, percentage, recent absences or late marks with dates and remarks, optional alert under a school threshold.

### 6.4 Examinations and results

Exam schedule, subject marks, total, percentage, grade, pass or fail, ranks if published, DMC or result download when available.

The addendum gates this view on fee status. See section 15.8.

### 6.5 Fees

Current month amount and due date, status and outstanding, previous months, advance credit, downloadable receipts.

The addendum requires every unpaid month to be visible, including three at once, and oldest-unpaid-first allocation. See section 15.10.

### 6.6 Timetable and updates

Class week timetable, approved lesson and daily updates, homework and classwork when enabled, school notices.

## 7. Connected information flow

| Information | Phase 1 | Phase 2 | Phase 3 |
|---|---|---|---|
| Student and class records | Create and manage | View assigned students | View linked child only |
| Attendance | Reporting and records | Record and review | Read-only |
| Exams and marks | Schedule, manage, report | Enter assigned marks | View results |
| Fees | Create, collect, reconcile | No fee editing | Status and receipts |
| Academic progress | Oversight | Record lessons and progress | Approved updates only |
| Timetable | Create | Personal timetable | Child's timetable |

## 8. Reports and documents

Sensitive reports stay with authorized roles.

| Area | Reports |
|---|---|
| Management | Dashboard summaries, student lists, admission trends, class distribution, all financial reports |
| Students | Admission records, profile and history, promotion and status records |
| Examinations | Schedule, marks sheet, result sheet, class result, ranks, DMC |
| Fees | Daily, monthly, class, and student collection; paid, unpaid, outstanding, advance |
| Finance | Income, expenses, income vs expenses, net status |
| Teacher | Attendance summaries, class progress, assigned marks status |
| Parent | Child attendance, results and DMC, fee status and receipts, timetable and updates |

## 9. Security, privacy, and audit

- Users see only their role's functions and rows.
- Parents: linked children only.
- Teachers: assigned classes, subjects, and permitted academic data only.
- Management has broad access and is responsible for sensitive data.
- Audit student status changes, marks finalization, and fee adjustments: who, what, when.
- No sensitive records on public pages. Documents and receipts require login.
- Backups and recovery are part of deployment, not a screen in this SRS.

The addendum adds server-side enforcement and a wider audit list. See section 15.13 and 15.15.

## 10. Baseline business rules

| Rule | Meaning |
|---|---|
| Academic sessions | No duplicate session name. Only one session is current. |
| Subjects | No duplicate subject name in the same session. |
| Timetable conflicts | A teacher is not in two classes at once. A class does not have two subjects at once. |
| Student enrollment | A student is enrolled only in a class that exists in the selected session. |
| Marks | Not negative, not above the configured maximum. |
| Marks submission | After submit or finalization, edits need controlled approval. |
| Fee payments | Amount is not negative or zero. The payment updates the correct fee records. |
| Advance payments | Credit stays identifiable until it is applied to future months. |
| Outstanding | Total due to date − total paid to date − advance credit applied. |
| Offline sync | Unique receipt or reference. Never create the same payment twice. |
| Dashboard math | Figures come from underlying records, never from hand-maintained totals. |
| Finance totals | Income, expenses, and net status are recalculated from entries. |

## 11. Delivery flow

`Requirements approval → UI/UX design → Development → Internal testing → Client UAT → Corrections → Go-live`

Each phase runs this cycle on its own, so Phase 1 can be in use while Phase 2 is still being built. Go-live includes initial data, user access, and training.

## 12. Functional requirements — baseline

### Phase 1

| ID | Requirement |
|---|---|
| P1-01 | Manage sessions, classes, subjects, teachers, teaching assignments, and timetable. |
| P1-02 | Process admissions from application through enrollment, including documents and interview or test. |
| P1-03 | Maintain student profiles and lifecycle history: promotion, activation, graduation, strike-off. |
| P1-04 | Schedule exams, enter and finalize marks, calculate results and ranks, generate DMC and reports. |
| P1-05 | Manage class fees, monthly fees, payments, receipts, outstanding, and advance. |
| P1-06 | Manage income, expenses, and financial reports. |
| P1-07 | Management dashboard and operational reports with the graphs in section 4.1. |
| P1-08 | Offline fee entry in Excel and safe sync without duplicate payments. |

### Phase 2

| ID | Requirement |
|---|---|
| P2-01 | Teacher dashboard: today's timetable, classes, pending work, attendance, progress. |
| P2-02 | Record attendance (Present, Absent, Late, and configured statuses) and view history. |
| P2-03 | Record lesson progress, classwork and homework, and daily class updates. |
| P2-04 | Enter assigned exam marks with draft and submit, under controlled permissions. |

### Phase 3

| ID | Requirement |
|---|---|
| P3-01 | Parent dashboard for linked children: attendance, results, fees, updates. |
| P3-02 | Attendance history, results, ranks, DMC, fee status, receipts. |
| P3-03 | Timetable, approved teacher updates, homework, relevant notices. |
| P3-04 | Secure login. A parent cannot view any student who is not linked to them. |

## 13. Client-facing summary

Phase 1 is the system of record: academic structure, admissions, examinations through report cards, fees, income and expenses, dashboard, and offline fee sync.

Phase 2 is each teacher's private workspace: today's timetable, attendance, lessons, daily updates, and assigned marks. Management reviews teacher activity. Approved updates can be shared with parents.

Phase 3 is a read-only window for linked children: attendance, results, fees, timetable, updates, homework, notices. No other student's data, and no edits.

## 14. Baseline sign-off

Both parties confirm that the baseline SRS matches the agreed scope. The PDF holds the signature blocks for Creative Leaders School and Abler Software Solutions. This markdown does not replace that signature page.

---

# Addendum v1.1 — 28 September 2026

This addendum supplements the baseline. Implement it without removing previously approved functionality unless a section below explicitly changes that functionality.

## 15.1 Purpose

Additional requirements from the school. They are additions or modifications. Previously approved behaviour stays unless changed here.

## 15.2 Updated roles (UR-01)

Three primary operational roles. They supersede the generic office-staff and exam-staff split. Teacher and Parent from section 3 remain.

| Role | Responsibility | Access |
|---|---|---|
| Super Admin | Complete control | View, create, edit, configure, and manage every module: users, academic setup, students, teachers, timetable, attendance, examinations, fees, reports, settings. May override or edit where the system allows controlled editing. |
| Accountant | Collect student fees | Record payments. Print and view their own collection records. Must not see the school's overall collection total, overall financial totals, or a calculated total of their own collection. They reconcile cash from the detailed table. |
| Academic / Operations Manager | All non-accounting operations | Teachers, assignments, attendance, timetable, subjects, classes, admissions, students, exams, results, lessons, daily tests, and other operational modules. Fee collection totals and financial controls stay restricted. |

## 15.3 One teacher, one subject (UR-02, BR-01, BR-02, BR-13)

- Creating a teacher requires a subject.
- A teacher has one active subject at a time.
- That subject is the default for teaching classes, timetable, attendance, lesson updates, and marks or test entry.
- Super Admin or the Academic / Operations Manager may change the active subject.
- Historical lessons, tests, marks, attendance, and substitutions keep the subject and class they were recorded under. Changing the current subject does not rewrite them.

## 15.4 Teacher assignment and timetable

The baseline Teacher + Subject + Class assignment and conflict detection still apply. New assignments default to the teacher's active subject.

## 15.5 Absent-teacher periods (UR-03, BR-03, BR-04)

- An authorized manager marks the teacher absent for a date and period.
- The system finds teachers with no class in that exact period.
- The manager picks the substitute. The system does not auto-assign.
- A teacher who already has a class at that time cannot be assigned. The check is automatic; the choice is manual.
- Record date, period, original teacher, substitute, class, subject, and who authorized it.
- The substitute sees that class in the teacher portal for that period.

## 15.6 Daily lesson and chapter updates (UR-04, BR-05)

- During class-subject setup, the Academic / Operations Manager defines planned chapters or lessons.
- The teacher selects the planned chapter when posting the daily update, and records the date and what was covered.
- Classwork, homework, and remarks stay optional, as in the teacher portal.
- Management reviews progress.
- Approved lesson updates can be shown to the relevant parent.

## 15.7 Weekly subject tests (UR-05, UR-06, BR-06, BR-07, BR-08)

- One test per subject per week, on a day the Academic / Operations Manager defines. About four tests per subject in a month.
- The teacher sees the test for their subject and class and enters each student's marks.
- Store marks by student, subject, class, test date or week, and month.
- Parents see marks only after they are published or approved.
- Monthly summary shows the weekly tests and the student's results.
- If a student fails more than one test in the same subject in the same month, flag them for follow-up and treat them as failed in that subject for that month.
- The definition of fail (minimum marks or percentage) is configurable by management.

## 15.8 Examination visibility and fees (UR-07, BR-09, BR-10)

- The Academic / Operations Manager publishes a result.
- Publication and parent visibility are separate. A result may be published internally and still hidden from a parent.
- After publication, the parent sees it only when the configured fee condition is met.
- If the condition fails, the parent does not see the result.
- An authorized user may override and show it anyway.
- Audit the override: user, student, date and time, and reason if the school requires one.
- The override does not change or delete the underlying marks.

## 15.9 Accountant collection (UR-08, BR-11)

- Select the student. Record amount, date, and the relevant fee month or months.
- A receipt or reference is generated or recorded.
- The accountant sees a daily table of payments they recorded: student name, admission or student id, payment date, fee month or months, amount paid, receipt or reference.
- That screen has no calculated grand total, including none in the API payload.
- They may print the detailed day table and individual receipts.
- Super Admin keeps overall fee totals and collection reports.
- Existing fee records, receipts, outstanding balances, and audit rules still apply.

## 15.10 Parent fees and oldest unpaid first (UR-09, BR-12)

- Every unpaid month is visible. If three previous months are unpaid, all three are shown.
- A payment equal to one month, while several months are unpaid, pays the oldest unpaid month first.
- Example: January, February, and March unpaid. One month's payment marks January paid. February and March stay unpaid. The next one-month payment marks February paid.
- A payment that covers several months still clears the oldest outstanding periods first, unless an authorized user explicitly records a different allocation.
- Receipts and history stay linked to the actual transaction.
- Baseline monthly records, outstanding carry-forward, Paid / Partially Paid / Unpaid / Advance, multi-month payments, advance, receipts, and collection reports all remain.

## 15.11 Parent academic view

- Examination results: visible only when the fee rule passes, or an authorized override is active.
- Daily test marks: visible for the linked child after publish or approval.
- Lesson and chapter updates: visible when approved for parents.
- Fee history: unpaid months and chronological status.
- Linked children only.

## 15.12 Updated business rules

| ID | Rule |
|---|---|
| BR-01 | One teacher, one active subject. Authorized management may change it. |
| BR-02 | That subject is the default for teaching access and new assignments. |
| BR-03 | A substitute cannot be assigned to a period where they already have a class. |
| BR-04 | Availability is checked automatically. Management confirms the substitute manually. |
| BR-05 | Management defines lesson and chapter content. The relevant teacher updates it. |
| BR-06 | Each subject has one scheduled weekly test. |
| BR-07 | The relevant teacher enters daily-test marks. The linked parent sees them after publication. |
| BR-08 | More than one failed weekly test in the same subject in a month flags a monthly subject failure. |
| BR-09 | Published examination results stay hidden from parents when the fee condition fails. |
| BR-10 | Authorized management may override that hide. |
| BR-11 | The accountant records fees and prints their own detailed records, and cannot see a calculated collection total. |
| BR-12 | When several months are unpaid, a normal payment applies to the oldest unpaid month first. |
| BR-13 | Historical records are not rewritten when current teacher assignments change. |
| BR-14 | Role permissions are enforced in the interface and on the server. |

## 15.13 Updated functional requirements

| ID | Requirement |
|---|---|
| UR-01 | Three primary operational roles: Super Admin, Accountant, Academic / Operations Manager. |
| UR-02 | Exactly one active subject per teacher, editable by authorized management. |
| UR-03 | Find available teachers for an absent period. Management chooses the substitute. |
| UR-04 | Planned chapters at class-subject setup. Teachers submit daily lesson updates. |
| UR-05 | Weekly subject tests, teacher mark entry, published marks visible to parents. |
| UR-06 | Flag a student who fails more than one weekly test in a subject in a month, using the configured pass criteria. |
| UR-07 | Hide parent examination results when the fee rule fails, unless an authorized override exists. |
| UR-08 | Accountant sees no calculated collection totals. Detailed personal records and printing remain. |
| UR-09 | Apply payments to the oldest unpaid month first when several months are outstanding. |

## 15.14 Developer notes from the addendum

- Enforce every role restriction on the server. Hiding a menu is not enough.
- Audit teacher subject changes, substitute assignments, result-visibility overrides, fee allocations, and daily-test outcomes.
- The substitute check uses timetable data for the exact day and period.
- Fee allocation is deterministic and transaction-safe. A partial payment must not skip an older unpaid month.
- Result publication and parent visibility are separate states.
- Accountant API responses must not include aggregate collection totals.
- Offline sync and duplicate-payment protection stay.
- Existing audit and role-based security stay.

## 15.15 Acceptance checklist

- A new teacher cannot be saved without one subject.
- Authorized management can change a teacher's current subject.
- An absent teacher's periods can be identified, and a conflict-free substitute can be selected.
- Daily chapter or lesson updates are created against the planned class subject.
- One weekly test per subject can be scheduled, and the assigned teacher can enter marks.
- Parents see published daily-test marks for their linked child.
- A student with more than one failed weekly test in the same subject in a month is flagged using the configured pass mark.
- An examination result stays hidden from a parent when the fee rule fails, unless an authorized override is applied.
- The accountant can print detailed daily collection records and sees no calculated total.
- When three months are unpaid, all three are shown, and a one-month payment clears the oldest.
- Super Admin can access and manage all modules.
- The Academic / Operations Manager can manage the academic and operational modules specified above.
- A parent account cannot access another student's data.

## 15.16 Relationship to the baseline

Read this addendum with Version 1.0 dated 20 September 2026. The phased architecture, admission workflow, examination workflow, fee records, receipts, attendance, lesson progress, parent portal, reporting, audit trail, and security model remain, except where this addendum is more specific.

## 15.17 Addendum sign-off

The PDF holds signature blocks for Creative Leaders School and Abler Software Solutions for the 28 September 2026 addendum.
