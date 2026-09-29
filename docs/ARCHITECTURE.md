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

## Plan for later phases (so Phase 1 does not need rework)

- **Sessions (Phase 2)**: `schedules` = recurring plan, `sessions` = actual occurrence
  (generated per date from schedules). `attendance` docs keyed by session + student,
  carrying `classId` so teacher rules stay the same pattern as `classEnrollments`.
- **Billing (Phase 3)**: `billingProfiles` are versioned with `effectiveFrom/effectiveUntil`;
  a new price = new version, old one closed. Invoice generation copies the rate onto each
  `invoiceItem` (and PER_SESSION items reference `sessionId`), so September invoices keep
  Rp50.000 after October's change. Financial docs carry `parentUids` for parent rules.
  Payment verification + invoice totals use Firestore transactions.
- **Parent portal (Phase 4)** reuses `parentUids`.
- **Reports (Phase 5)**: browser print CSS for PDF, client-side CSV.
