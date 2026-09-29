# Architecture

## Overview

```
Browser (React SPA on Vercel)
   │  Firebase JS SDK
   ├── Firebase Auth       email/password login, password reset
   ├── Cloud Firestore     all data; Security Rules enforce roles
   └── Firebase Storage    photos (later: materials, homework, payment proofs)
```

There is no server. Every read/write goes from the browser straight to Firebase, so
**`firestore.rules` is the security boundary**. Route guards in React only hide screens.

Writes that touch several documents (class change + history + audit log, teacher
assignment + rule helpers) use `writeBatch`, so they succeed or fail together.

## Roles

`users/{uid}.role` ∈ `admin | teacher | parent | owner`, plus `active: boolean`.
Only admins can write `users` documents, so nobody can raise their own role.

| Role | Phase 1 access |
|---|---|
| admin | read/write everything below |
| owner | read students, classes, teachers, levels, class history, audit logs |
| teacher | read own classes (`classes.teacherUid == uid`), students whose `currentClassId` is in `users.classIds`, enrollment history of own classes |
| parent | read own `parents` doc and students where `uid in students.parentUids` |

## Rule helper fields (denormalized on purpose)

Firestore rules cannot run queries, so a few fields exist to make rules cheap and provable:

| Field | Maintained by | Used for |
|---|---|---|
| `students.parentUids[]` | link/unlink parent, create parent account | parent reads child |
| `classes.teacherUid` | save class, create teacher account | teacher reads class |
| `users.classIds[]` (teacher) | save class, create teacher account | teacher reads students / enrollments |
| `students.currentClassName` | class change, class rename | parent sees class name without reading `classes` |

All four are written only in `src/services/*`, inside the same batch as the change that affects them.

## Collections (Phase 1)

| Collection | Key fields |
|---|---|
| `users/{uid}` | email, displayName, role, active, parentId, teacherId, classIds |
| `students` | fullName, nickname, photoUrl/photoPath, gender, dateOfBirth, school, schoolGrade, address, startDate, currentLevelId, currentClassId, currentClassName, status, notes, parentIds, parentUids |
| `parents` | userId, fullName, phone, whatsapp, email, address, relationship |
| `teachers` | userId, fullName, photoUrl/photoPath, phone, email, address, specialization, status |
| `levels` | name, description, order, active |
| `classes` | className, levelId, teacherId, teacherUid, roomId (Phase 2), capacity (0 = unlimited), status |
| `classEnrollments` | studentId, classId, className (snapshot), levelId, startDate, endDate, status active/ended, note, createdBy |
| `auditLogs` | userId, action, module, recordId, oldData, newData, timestamp — append-only |

Conventions: document ID is the record ID (`studentId` = doc id). Date-only values are
`YYYY-MM-DD` strings (no timezone bugs, sortable), shown as DD/MM/YYYY. `createdAt` /
`updatedAt` are server timestamps. Students, classes, levels and teachers are never
hard-deleted — they are deactivated, so history and reports stay intact.

## Class history

Moving a student never overwrites the past: the active `classEnrollments` row gets
`endDate` + `status: 'ended'`, a new active row is created, the student's `current*`
fields are updated, and an audit log is written — one batch. Phase 3 billing and
reports will use `classEnrollments` to know which class a student was in on any date.

## Phase 2 — academic

| Collection | Key fields | Notes |
|---|---|---|
| `rooms` | name, capacity, status | |
| `schedules` | classId, teacherId, roomId, dayOfWeek (1=Mon…7=Sun), startTime, endTime, duration, status | Recurring plan. Clash check (class / teacher / room, overlapping time, same day, active only) in `saveSchedule` |
| `sessions` | classId, scheduleId, teacherId, roomId, date, startTime, endTime, topic, lessonId, status, notes, cancelReason, completedAt/By | The actual occurrence. Id `${scheduleId}_${date}` makes generation idempotent; extra sessions use `extra_…` ids |
| `attendance` | sessionId, classId, studentId, studentName, date, status, checkInTime, notes, recordedBy | Id `${sessionId}_${studentId}` = one row per student per session. Saving marks the session completed in the same batch |
| `semesters` | levelId, name, order | Level → Semester |
| `lessons` | levelId, semesterId, weekNumber, title, objective, vocabulary, grammar, speaking, listening, reading, writing, activities, homework, teachingNotes, duration | → Week → Lesson |
| `materials` | title, type, storageUrl, storagePath, fileName, levelId, lessonId, topic, skill, createdBy | File in Storage `materials/{id}/…`, metadata here |
| `homework` | classId, lessonId, title, description, assignedDate, dueDate, attachment*, status, createdBy | Attachment in Storage `homework/{id}/…` |
| `studentProgress` | studentId, studentName, classId, assessedAt, scores{skill: 1–5 or null}, notes, recordedBy | Append-only: rules forbid update/delete for everyone |

**Roster for a session** is computed from `classEnrollments` active *on the session date*
(`startDate <= date < endDate`). That way old sessions keep the students who were really in the class then.

**Teacher rules** all follow one pattern: `resource.data.classId in users/{uid}.classIds`.
Teacher queries therefore always include `where('classId', '==', …)`, one query per class.
Teachers may update only `topic, lessonId, notes, status (scheduled|completed), completedAt/By`
on their sessions. Only admins create, cancel or restore sessions. Attendance writes are checked
against the session document: same class, same date, and the session is not cancelled.

**Curriculum** (semesters, lessons) and **materials** are readable by all staff, including teachers of other levels.
They are shared teaching content with no personal data, and limiting them per level would need extra sync fields.
If you want them limited per level, add a `levelIds` field next to `classIds`.

Composite indexes (`firestore.indexes.json`): `sessions(classId, date)` and `attendance(classId, date)`.

## Phase 3 — finance

All amounts are integer Rupiah. Pure calculation lives in `src/lib/billing.ts` (unit-tested). Firestore writes live in `src/services/{billingProfiles,invoices,payments}.ts`.

| Collection | Notes |
|---|---|
| `billingProfiles` | **Versioned.** A new price or type = the current version gets `effectiveUntil = newFrom − 1 day` and a new version is created. Old versions are never edited. This replaces a separate `billingRates` collection. |
| `invoices` | `invoiceNumber` is null while draft and assigned on issue. Stored status: draft / unpaid / partially_paid / paid / cancelled. "overdue" is derived (`effectiveStatus`). Has `parentUids` for the parent portal. |
| `invoiceItems` | PER_SESSION items carry `sessionId` + `sessionDate`, one item per billed session. Draft items have empty `parentUids`. |
| `payments` | pending → verified \| rejected. Only verified payments change the invoice. |
| `receipts` | Id = paymentId (1:1). Created in the same transaction as verification. Immutable. |
| `counters` | `invoice-YYYYMM`, `payment-YYYYMM`, `receipt-YYYYMM`. Incremented inside transactions → `INV/202610/0001`. |
| `settings/institution`, `settings/finance` | Letterhead, prefixes, due days, billable rules, payment methods, payment instructions. |

**PER_SESSION pipeline:** completed session → the student's attendance row → billable rule (default Present/Late) → price from the profile version active *on the session date* → one invoice item per session. Sessions already on a non-cancelled invoice are skipped, so re-running a month never double-bills. Cancelling an invoice frees its sessions.

**MONTHLY:** one item with the fixed monthly rate. Attendance is ignored. Duplicate monthly invoices for an overlapping period are skipped.

Discount and additional fee come from the version active at the start of the period: `total = subtotal − discount + additionalFee`.

**Payment verification** runs one transaction: read payment + invoice + receipt counter → `applyPayment` (rejects amounts above the balance) → update invoice (paid / partially_paid), mark payment verified, create receipt with previous/remaining balance, and write the audit log.

Rules: teachers have no finance access. Parents may read finance documents containing their uid (not drafts). Issued invoices cannot be deleted, only cancelled, and only if nothing has been paid. Verified payments and receipts are read-only.

## Phase 4 — parent portal

Parent access follows the same pattern as teachers: fields on the user doc that rules check with `in`.

| Field | Written by | Rules use |
|---|---|---|
| `users/{uid}.childIds` | `syncParentUsers` | attendance, studentProgress, homeworkSubmissions (`studentId in childIds`) |
| `users/{uid}.childClassIds` | `syncParentUsers` | classes, schedules, sessions, homework (`classId in childClassIds`) |
| `parentUids` on invoices/items/payments/receipts/billingProfiles | `syncStudentFinanceParents`, `issueInvoice` | `uid in resource.data.parentUids` |

Sync runs after `linkParent`, `unlinkParent`, `createParentAccount`, and `changeStudentClass`. The *Sinkronkan akses portal* button rebuilds everything from `students.parentIds` (the source of truth).

Draft invoices keep `parentUids: []` until issued, so parent queries (`array-contains uid`) never see drafts.

New collection `homeworkSubmissions/{homeworkId}_{studentId}`: the parent creates or replaces it while the homework is active. The teacher or admin can only change `status/feedback/reviewed*`.

Parent payment proof: the parent creates `payments` with `status: 'pending'` and `paymentNumber: ''`. Rules check that the invoice is theirs, still open, the amount is ≤ outstanding, and `parentUids`/`billingType` match. The file goes to Storage `payment-proofs/{uid}/…`. `verifyPayment` assigns the payment number and the receipt in one transaction.

Materials have `visibleToParents`, and parents query with `where('visibleToParents', '==', true)`. Lessons are readable by parents (shared teaching content). `teachingNotes` are hidden in the parent UI.

## Phase 5 — reports & communication

**Reports:** `src/lib/reports.ts` has pure builders (student, class, attendance, progress, revenue, outstanding, payments, per-session billing, monthly billing). Each returns `{columns, rows, totals}`. `src/services/reports.ts` loads only the collections each report needs (date-range queries on single fields, so no extra indexes). The same result feeds the on-screen table, `toCsv` (`;` separator + UTF-8 BOM for Indonesian Excel), and browser print (filters hidden, letterhead shown).

**Announcements** (`announcements`): admin-only writes. Readers query `published == true && audience in [...]`, exactly what the rules check. `classIds` narrows display client-side. The first publish notifies the target parents/teachers.

**Notifications** (`notifications`): `{userId | targetRole:'admin', title, body, link, read}`. They are created client-side by the acting user after the main write (`notifyUsers`, `notifyAdmins`). Recipients may only flip `read`. The bell subscribes with `onSnapshot` (indexes: `userId+createdAt`, `targetRole+createdAt`).

| Event | Recipient |
|---|---|
| Invoice issued, payment verified/rejected, session cancelled, new homework, homework reviewed, new assessment | Parents (`parentUids`) |
| Parent sends payment proof | All admins (`targetRole: 'admin'`) |
| Parent submits homework | Class teacher (`classes.teacherUid`) |
| Announcement published | Target parents/teachers |

**Audit log viewer:** latest 300 `auditLogs` (admin/owner), with before/after JSON.

## If the center grows

- Add monthly summary docs (revenue, attendance per class) and write them together with the source change, so reports stop scanning raw collections.
- Move notifications and parent-access sync to Cloud Functions triggers. This is the first place a small server would pay off. The client code is already isolated in `services/notifications.ts` and `services/parentAccess.ts`.
