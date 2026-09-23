# MediQ

A rural public-healthcare app for Maharashtra: symptom triage, daily token queue,
teleconsultation, e-prescriptions and outbreak analytics. React + Vite + TypeScript,
Tailwind, Firebase (Auth, Firestore, Storage, Cloud Functions).

## Quick start (demo mode — no keys needed)

```bash
cd app
npm install
npm run dev
```

The app runs fully offline-capable in **demo mode** (localStorage, visible demo badge):
seeded with 6 verified doctors, 1 pending doctor and 1 admin. Phone OTP demo code is
`123456`; email links open a demo inbox inside the app.

## Going live with Firebase

1. Create a Firebase project, enable the **Blaze** plan.
2. Enable **Authentication**: Phone provider + Email link (passwordless).
3. Create a **Firestore** database, then deploy rules + indexes:
   `firebase deploy --only firestore` (see `firestore.rules`,
   `firestore.indexes.json`). The composite indexes are required by the doctor
   directory and doctor-appointment queries; Firestore will also link you to
   create any missing one from the console error.
4. Deploy storage rules: `firebase deploy --only storage` (see `storage.rules`).
5. Deploy functions: `cd functions && npm install && npm run deploy`.
6. Copy `.env.example` to `.env` and fill the `VITE_FIREBASE_*` values. The app
   switches to Firebase automatically when they are set.
7. Set function secrets:
   `firebase functions:secrets:set GEMINI_API_KEY`
   `firebase functions:secrets:set SMS_API_KEY`
8. **First admin bootstrap** (one time): sign in with the admin's phone/email,
   then call the `bootstrapAdmin` Cloud Function (Firebase console → Functions →
   call it once, or `firebase functions:call` via a small script). It sets
   `role: admin` on your own user only, and refuses once any admin exists.
   Further admins are created by an existing admin through the Admin panel.
9. After registering, doctors appear in **Admin → Verify queue**; approval goes
   through the `setDoctorVerification` function (the client cannot self-verify —
   security rules deny it).

Custom claims (`role`, `verified`) are synced automatically by the
`syncUserClaimsOnCreate` / `syncUserClaimsOnUpdate` triggers whenever a user
doc changes. After approval, the doctor should refresh/re-sign-in so the app
picks up the new claims.

## Connection checklist (external services)

| Service | Where | Status without it |
|---|---|---|
| Firebase Auth (phone OTP) | console | Demo OTP `123456` only |
| Firebase email link | console | Demo inbox only |
| Gemini | `GEMINI_API_KEY` secret | Deterministic rule replies only |
| SMS provider | `sendSms` function + `SMS_API_KEY` | Logged, not sent |
| 108 dispatch | `Emergency.tsx` | Tap-to-call `tel:108` + in-app alert log |
| TURN server | `Consult.tsx` ICE config | STUN-only WebRTC |
| ABHA / ABDM | — | Not wired: no ABHA ID is shown or generated; optional linking is stubbed in Profile |

> Honest-limits note: in **demo mode** the OTP is `123456`, SMS is a console
> log, the Gemini key (if set in `.env`) only affects the browser client — in
> production all SAATHI traffic goes through the `saathiChat` Cloud Function and
> the key lives in secrets, never in the bundle. Phone OTP costs ~$0.01 per
> verification on the Blaze plan after the free tier.

## Scripts

- `npm run dev` — local dev
- `npm run build` — production build
- `npx tsc --noEmit` — strict typecheck
- Logic smoke test (triage + tokens + SAATHI): from `app/`,
  `npx esbuild scripts/smoke.ts --bundle --platform=node --format=esm \
   --outfile=/tmp/smoke.mjs --log-level=error --define:import.meta.env='{}' && node /tmp/smoke.mjs`

## Project layout

```
src/
  pages/        patient/ doctor/ admin/ + Landing, Auth, Saathi, Emergency, Consult
  components/   ui kit, SVG icons, SVG charts
  lib/          triage engine, token engine, SAATHI brain, auth, store, pdf, notify
  i18n/         English + Hindi dictionaries
  auth/         auth context + route guards
functions/      Cloud Functions: issueToken, saathiChat, sendSms
firestore.rules / storage.rules
```

## Design notes

- Deterministic triage: red flags first, always; scores 0–29 Normal, 30–69 Moderate,
  70–100 Emergency. AI (Gemini) may only rephrase SAATHI chat — never triage.
- Token codes: `NOR001` / `MOD001` / `EMR001`, reset daily (IST). Production issuance
  is transactional in the `issueToken` Cloud Function (doc id = triageId).
- Doctors see the queue only after admin licence verification.
- No gradients, no purple, no emoji UI — clean blue/white clinical theme, EN/HI.
