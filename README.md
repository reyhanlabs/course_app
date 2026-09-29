# English Course Management System

Management app for a small English tutoring center. Built for a solo developer:
**React + TypeScript (Vite) → Firebase (Auth, Firestore, Storage) → Vercel**, source on GitHub.
No backend server, no Cloud Functions, no Docker.

UI language: Indonesian · Currency: IDR · Dates: DD/MM/YYYY

## Status

| Phase | Scope | Status |
|---|---|---|
| 1 | Auth, roles, Security Rules, admin dashboard, Students, Parents, Teachers, Levels, Classes, class history | **Done** |
| 2 | Rooms, schedules (conflict checks), sessions, attendance, curriculum, lessons, materials, homework, student progress | **Done** |
| 3 | Versioned billing profiles, PER_SESSION / MONTHLY invoices, partial payments, verification, receipts, A4 print/PDF, WhatsApp/email sharing, finance dashboard, settings | **Done** |
| 4 | Parent portal: child switcher, schedule, attendance, lessons, materials, homework submission + teacher feedback, progress, invoices, payment-proof upload, payments, receipts | **Done** |
| 5 | 9 reports with filters + CSV + print/PDF, announcements (with WhatsApp share), in-app notifications, audit log viewer, academic settings, grouped menu | **Done** |

All five phases are implemented. Menus only show features that actually work.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the data model and security design.

## 1. Firebase setup (once)

1. Create a project at https://console.firebase.google.com.
2. **Authentication** → Sign-in method → enable **Email/Password**.
3. **Firestore Database** → create database (production mode, region e.g. `asia-southeast2` Jakarta).
4. **Storage** → get started (same region).
5. Project settings → General → **Add app → Web**. Copy the config values.
6. Authentication → Settings → **Authorized domains** → add your Vercel domain (e.g. `kursus.vercel.app`) after the first deploy.
7. Optional: Authentication → Templates → translate the *Password reset* email to Indonesian. New accounts receive this email to set their own password.

## 2. Local development

```bash
git clone <your-repo> && cd english-course-management
npm install
cp .env.example .env.local     # fill in the Firebase values
npm run dev                    # http://localhost:5173
```

`.env.local` is git-ignored. Never commit it.

## 3. Deploy Security Rules

The rules in `firestore.rules` and `storage.rules` are the real security layer. Deploy them before using real data:

```bash
npm install -g firebase-tools
firebase login
cp .firebaserc.example .firebaserc   # put your project id in it
npm run deploy:rules
```

On the first Storage deploy, Firebase asks to let Storage rules read Firestore (needed for role checks). Accept it.

## 4. Create the first admin (once)

Admins create every other account from inside the app, so only the first admin is manual:

1. Firebase Console → Authentication → **Add user** (your email + a password). Copy the **User UID**.
2. Firestore → Start collection `users` → Document ID = **that UID**, fields:

| field | type | value |
|---|---|---|
| email | string | your email |
| displayName | string | your name |
| role | string | `admin` |
| active | boolean | `true` |
| parentId | null | |
| teacherId | null | |
| classIds | array | (empty) |

3. Log in to the app.

## 5. Deploy to Vercel

1. Push to GitHub.
2. Vercel → **Add New Project** → import the repo. Framework is detected as Vite (`vercel.json` also sets it and adds the SPA rewrite).
3. Settings → **Environment Variables**: add every `VITE_*` variable from `.env.example` (Production + Preview).
4. Deploy. Then add the Vercel domain to Firebase Auth *Authorized domains* (step 1.6).

Every push to `main` redeploys automatically. Rules are deployed separately with `npm run deploy:rules`.

## 6. How accounts work

- **Admin / Owner**: menu *Pengguna* → "Akun admin / owner".
- **Teacher**: menu *Guru* → "Buat akun" (links the login to the teacher record and their classes).
- **Parent**: menu *Orang Tua* → "Buat akun" (links the login to all their children).

The account is created with a random password nobody sees, then Firebase sends a password-setup email.
This runs entirely in the browser using a second, in-memory Firebase Auth instance, so the admin stays logged in.

Deactivate a user in *Pengguna* → they lose access to all data immediately (rules check `active`).

## 7a. Billing logic tests (run anywhere, no emulator)

```bash
npm test
```

`tests/unit/reports.test.ts` checks report totals and the CSV format. `tests/unit/billing.test.ts` checks spec TEST 1–5 against the same functions the app uses (`src/lib/billing.ts`):
7 billable sessions × Rp50.000 = Rp350.000, MONTHLY Rp350.000 regardless of 8 sessions, 500.000 → 300.000 partial → 200.000 paid,
and the September Rp50.000 / October Rp60.000 price change.

## 7. Testing the Security Rules

`tests/rules/phase1.rules.test.ts` covers spec **TEST 6** (parent with two children sees both, nobody else) and
**TEST 7** (teacher of Class A cannot read Class B or its students), plus role-escalation checks. `tests/rules/phase2.rules.test.ts` covers sessions, attendance, progress (append-only), homework and materials. `tests/rules/phase3.rules.test.ts` covers finance (parent isolation, no teacher access, immutable receipts and verified payments). `tests/rules/phase4.rules.test.ts` covers the parent portal (other children's data, closed homework, forged payments). `tests/rules/phase5.rules.test.ts` covers announcements and notifications.

```bash
npm install -g firebase-tools   # emulator also needs Java 11+
npm run test:rules
```

To run the whole app against emulators: `firebase emulators:start`, set `VITE_USE_EMULATORS=true`, then `npm run dev`.

## 8. Phase 1 manual checklist

- [ ] Log in / log out / "Lupa kata sandi" email arrives
- [ ] Levels: "Buat level awal" creates Kindergarten, Grade 1 SD, Grade 2 SD, Grade 3–4 SD; reorder, rename, deactivate work
- [ ] Create teacher → create class with that teacher → create teacher account → teacher sees only that class
- [ ] Create student → put in class → move to another class → student detail shows both rows in *Riwayat kelas*
- [ ] Create parent with two children → create account → parent sees both children, can switch between them
- [ ] Owner sees dashboard, students, classes but no edit buttons
- [ ] Mobile width (≈390px): sidebar becomes a drawer, tables scroll horizontally

## 9. Phase 2 manual checklist

- [ ] Rooms: add Ruang 1 and Ruang 2
- [ ] Schedules: Grade 1 A every Monday 15:00–16:00. Adding another class in the same room at 15:30 Monday is rejected (room clash). The same teacher at an overlapping time is rejected (teacher clash).
- [ ] Sessions: "Buat sesi dari jadwal" for this month creates one session per Monday. Running it again creates 0 (no duplicates).
- [ ] Cancel a session with a reason, then restore it. A teacher cannot see the cancel button.
- [ ] Open today's session as the teacher → pick a lesson, save the plan → take attendance → the session becomes *Selesai*.
- [ ] A future session cannot be attended yet.
- [ ] Move a student to another class, then open a session from *before* the move: the student still appears in that old session's roster.
- [ ] Absensi → monthly recap shows H/T/I/A per session and a % per student. Late counts as present.
- [ ] Curriculum: Kindergarten → Semester 1 → Week 1 "Greetings". A lesson used in a session cannot be deleted.
- [ ] Materials: upload a PDF and add a YouTube link, then link one to a lesson. The lesson popup lists it.
- [ ] Homework with an attachment. A teacher only sees their own classes.
- [ ] Progress: assess a student twice; both rows stay in the history. The student detail page (admin) shows attendance + progress.
- [ ] Deploy indexes (`npm run deploy:rules`) before using the recap and teacher session lists, or Firestore returns an index error with a link to create it.

## 10. Phase 3 manual checklist

- [ ] Pengaturan: fill in the institution (name, address, logo) and the finance settings (prefixes, due days, payment instructions).
- [ ] Tarif: Student A PER_SESSION Rp50.000 from 01/09/2026, Student B MONTHLY Rp350.000.
- [ ] Take attendance for Student A's sessions (some Absent). Tagihan → Buat tagihan → September: A shows only billable sessions (dates listed), B shows Rp350.000.
- [ ] Buat draft → open a draft → add item "Buku" → change discount → Terbitkan: the number becomes INV/2026MM/0001.
- [ ] Run "Hitung" for September again: A's already-billed sessions are not billed twice, and B shows "Sudah ada tagihan bulanan".
- [ ] Catat pembayaran Rp300.000 of Rp500.000 → Dibayar sebagian, sisa Rp200.000, kuitansi shows saldo sebelumnya/sisa. Then Rp200.000 → Lunas + LUNAS stamp.
- [ ] Record a transfer *without* "Langsung verifikasi" → it appears in Pembayaran as pending → Verifikasi / Tolak.
- [ ] Try paying more than the remaining balance → rejected.
- [ ] Tarif A → Rp60.000 from 01/10/2026. The September invoice is unchanged; October uses Rp60.000; *Riwayat tarif* shows both versions.
- [ ] Cetak / Unduh PDF on the invoice and receipt (A4, sidebar hidden). WhatsApp opens with a pre-filled message.
- [ ] Log in as teacher: no finance menu, and direct URLs show "tidak tersedia".

## 11. Phase 4: upgrade steps and checklist

**When upgrading an existing project to Phase 4 (once):**
1. `npm run deploy:rules`
2. Log in as admin → Orang Tua → **Sinkronkan akses portal**. This fills the new access fields for parents created in earlier phases.

Checklist:
- [ ] Parent with two children: the pills at the top switch between the children, and every page follows the selected child.
- [ ] Ringkasan shows 30-day attendance, next session, open homework, outstanding balance, and the latest assessment.
- [ ] Jadwal shows the weekly schedule plus the next 30 days. A cancelled session shows the reason.
- [ ] Materi only shows materials marked "Terlihat orang tua" for the child's level (or all levels).
- [ ] PR: submit a photo → the teacher opens PR → Jawaban → writes feedback → the parent sees the feedback.
- [ ] Tagihan → Kirim bukti bayar → the admin sees a pending payment "Dari orang tua" → Verifikasi → it gets a payment number, the receipt appears in the parent's Kuitansi, and the balance drops.
- [ ] The parent opens Lihat on an invoice and a receipt and can print/save it as PDF.
- [ ] Move a child to another class → the parent sees the new class schedule without re-syncing.
- [ ] Link a parent to a child that already has invoices → the parent sees those invoices.

## 12. Phase 5 checklist

Run `npm run deploy:rules` first (new rules + 2 notification indexes).

- [ ] Laporan: each of the 9 reports loads for this month. Change the period/class/type filters. **CSV** opens cleanly in Excel (semicolon-separated, UTF-8). **Cetak / PDF** prints only the letterhead + table.
- [ ] Owner sees Laporan Akademik and Laporan Keuangan as separate menu items.
- [ ] Pengumuman: publish one for "Orang tua" in class Grade 1 A → a Grade 1 A parent sees it on Ringkasan and gets a bell notification; a Grade 2 parent does not see it; teachers do not see it.
- [ ] "Bagikan ke WhatsApp" opens WhatsApp with the text so you can pick a parents' group.
- [ ] Bell notifications: issue an invoice (parent), verify/reject a payment (parent), parent sends proof (admin), new homework (parents of the class), parent submits homework (class teacher), teacher gives feedback (parent), cancel a session (parents), new assessment (parents).
- [ ] Log Aktivitas lists invoice, payment, rate, and class changes with before/after data.
- [ ] Pengaturan → Akademik: set the default duration to 90 minutes → a new schedule at 15:00 automatically ends at 16:30.

## Known limitations (by design, to stay serverless)

- Deleting or changing the email of a Firebase Auth account cannot be done from the browser. Deactivate the user instead; delete from the Firebase Console if really needed.
- If creating an account fails halfway (Auth user created, Firestore write failed), the Auth user exists without a profile. Delete it in Firebase Console → Authentication and try again.
- Photo URLs are Firebase download URLs; anyone holding the exact URL can view that photo. The URLs are only stored in documents protected by rules.
- A substitute teacher set on a *schedule* is used for clash checks, but only the class's own teacher can open that class in the app (access follows the class).
- A verified payment cannot be undone from the app (by design, receipts are immutable). If a mistake happens, record it in the notes and correct it with a new invoice or item. A "void payment" flow with a reversal record can be added later.
- "Terlambat" (overdue) is calculated when displayed (unpaid + past due date), not stored, because there is no scheduled server job.
- Parent access relies on copied fields (`users.childIds/childClassIds`, `parentUids` on finance docs). The app updates them automatically after linking, account creation, and class changes. These updates run right after the main change, not in the same transaction, so if the connection drops in between, use **Sinkronkan akses portal**.
- Parents see sessions/schedules of the child's *current* class. Older attendance stays visible (it is keyed by student).
- Notifications are written by the user who performs the action (no server). They are best-effort: if one fails, the main action still succeeds. Nothing is sent outside the app (no push/SMS/WhatsApp API). WhatsApp and email use pre-filled links.
- Announcement class targeting is a display filter, not a security boundary. Do not put private information in announcements.
- Reports compute in the browser from the collections involved. This is fine for hundreds of students and a few years of data. For much larger data, add pre-aggregated monthly summaries.
- Lists load whole collections and sort in the browser. This is fine for a small center (hundreds of students); add pagination if it grows into thousands.

## Project structure

```
src/
  auth/         AuthContext (user + live profile), route guards, per-role menus
  components/   UI kit (ui.tsx), layout, shared modals
  hooks/        useAsync (loading / error / reload)
  lib/          firebase init, env check, formatting (DD/MM/YYYY, Rupiah), error messages
  pages/        one file per screen
  services/     all Firestore/Storage/Auth logic — pages never write to Firestore directly
  types/        data model types
firestore.rules  storage.rules  firestore.indexes.json  firebase.json
tests/          Security Rules tests (emulator)
```
