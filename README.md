# English Course Management System

Management app for a small English tutoring center. Built for a solo developer:
**React + TypeScript (Vite) → Firebase (Auth, Firestore, Storage) → Vercel**, source on GitHub.
No backend server, no Cloud Functions, no Docker.

UI language: Indonesian · Currency: IDR · Dates: DD/MM/YYYY

## Status

| Phase | Scope | Status |
|---|---|---|
| 1 | Auth, roles, Security Rules, admin dashboard, Students, Parents, Teachers, Levels, Classes, class history | **Done** |
| 2 | Rooms, schedules, sessions, attendance, curriculum, lessons, materials, homework, progress | TODO |
| 3 | Billing profiles & price history, PER_SESSION / MONTHLY invoices, partial payments, receipts | TODO |
| 4 | Parent portal (schedule, attendance, homework, progress, invoices, receipts) | TODO — Phase 1 already has "Anak Saya" |
| 5 | Reports, print/PDF, CSV, announcements, WhatsApp/email sharing | TODO |

Menus only show features that actually work. Screens mention when something arrives in a later phase instead of showing fake buttons.

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

## 7. Testing the Security Rules

`tests/firestore.rules.test.ts` covers spec **TEST 6** (parent with two children sees both, nobody else) and
**TEST 7** (teacher of Class A cannot read Class B or its students), plus role-escalation checks.

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

## Known limitations (by design, to stay serverless)

- Deleting or changing the email of a Firebase Auth account cannot be done from the browser. Deactivate the user instead; delete from the Firebase Console if really needed.
- If creating an account fails halfway (Auth user created, Firestore write failed), the Auth user exists without a profile. Delete it in Firebase Console → Authentication and try again.
- Photo URLs are Firebase download URLs; anyone holding the exact URL can view that photo. The URLs are only stored in documents protected by rules.
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
