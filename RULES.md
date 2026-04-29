# Application Rules

This document defines pragmatic rules for this application focused on reliability, security, and maintainability.

## Priority Levels

- **P0 (critical):** must be fixed before release.
- **P1 (important):** should be fixed in current/next iteration.
- **P2 (improvement):** recommended when time allows.

## P0 Rules (Mandatory)

### Security and Data Isolation

**Roles (current scope):** only the **team admin** is supported: the authenticated user who owns the team document (`team.ownerId == request.auth.uid`). A separate **player** user (read-only + convocatorias) is **out of scope** until explicitly designed (e.g. `users/{uid}`, `team/{id}/members/{uid}`, or custom claims + `Player.linkedUserId`).

1. Firestore rules must enforce ownership by `ownerId` and team isolation by `teamId`.
2. No authenticated user may read or write another team's data.
3. Every client query must include `teamId` filtering where data is team-scoped.

### Domain Consistency

4. Attendance states must be consistent across:
   - `src/types.ts`
   - Firestore validation rules
   - UI forms and update logic
5. A completed match must always have valid score values (`goalsFor`, `goalsAgainst`).

### Environment and Runtime Safety

6. Required env vars must exist in `.env.local` before startup:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_APP_ID`
7. `.env.local` must never be committed.

## P1 Rules (Important)

### Data Integrity

8. Any delete operation affecting related entities must execute a full cascade cleanup.
9. Legacy and current data models cannot coexist as independent sources of truth (e.g. deprecated season links vs `playerSeasons`).
10. Avoid orphan documents; cleanup utilities must run after destructive operations when needed.

### Business Logic Consistency

11. Prediction/scoring logic must be centralized; do not duplicate formula behavior in multiple places.
12. Changes to match attendance must keep player stats and derived values synchronized.

### UX and Error Handling

13. Firestore/Auth errors must be surfaced to users with clear messages.
14. Critical async flows (login, bootstrap, save, delete) must expose loading and failure states.

## P2 Rules (Recommended)

### Performance and Cost

15. Avoid storing large Base64 payloads in Firestore documents; prefer Firebase Storage.
16. Keep listener/query scopes narrow to reduce reads and noise.

### Code Quality

17. Keep `App.tsx` as orchestrator only; move reusable logic to `src/lib` when possible.
18. Any new rule change must update docs and examples (`README.md`, `.env.example`) in the same PR.

## Definition of Done (Feature Checklist)

A feature is done only if all applicable checks pass:

1. **Security:** respects team/user data boundaries.
2. **Data:** preserves integrity, no orphan side effects.
3. **Domain:** no contradiction with current domain states and invariants.
4. **Env:** required config documented and validated.
5. **Errors:** user-facing failures are handled and actionable.
6. **Verification:** at minimum, manual verification of login + affected CRUD flow.

## Change Control Rule

Any change touching:
- authentication,
- Firestore rules,
- match lifecycle,
- player-season relationships,

must include explicit validation notes in the PR description.
