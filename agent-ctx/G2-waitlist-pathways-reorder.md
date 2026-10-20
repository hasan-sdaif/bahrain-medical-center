# Task G2 — Waitlist/Recalls + Therapeutic Pathways + Auto-Reorder (قائمة الانتظار + البرامج العلاجية + إعادة الطلب التلقائي)

Agent: gap-implementation agent G2 (Z.ai Code) — WRITE CODE
Date: 2026-10-24
Gap source: R1 (OpenEMR Recalls) + R2 (OpenMRS/Bahmni PatientProgram, Frappe auto material request) —
models existed in prisma/schema.prisma but had ZERO activation (no API, no UI, no consumer).
Worklog entry: `Task ID: G2` (end of /home/z/my-project/worklog.md).

## Files I own (do not edit without coordination)
- `src/server/staff/core.ts` — appended section `── Waitlist / recalls (استدعاءات — قائمة انتظار المواعيد)`
  at the end of the routes table (GET waitlist/list, POST waitlist/add, POST waitlist/offer).
- `src/server/staff/clinical.ts` — appended section `── Therapeutic programs / pathways (البرامج العلاجية — gap G2)`
  AFTER G1's immunizations routes (GET pathways/list, GET pathways/for-patient, POST pathways/enroll,
  POST pathways/advance). G1's trailing helper block (VACCINE_WHITELIST etc.) still ends the file.
- `src/server/scheduler.ts` — added `runReorderCheck()` export + REORDER_INTERVAL_MS throttle (10 min)
  wired as step 6 in runSchedulerTick; result type += `reorders`.
- `src/server/staff/ops.ts` — 3 defensive fixes for asset-less reorder WorkOrders: work-orders map
  `asset: w.asset ? {...} : null` + titleAr passthrough; wo-status + wo-close asset updates guarded
  behind `w.assetId`.
- `src/components/portals/staff/reception-waitlist.tsx` — NEW (250 ln) `ReceptionWaitlist` tab component.
- `src/components/portals/staff/reception.tsx` — added 4th tab (waitlist) importing ReceptionWaitlist.
- `src/components/portals/staff/emr-programs.tsx` — NEW (210 ln) `ProgramsCard` (enroll dialog, step
  chips, advance button, past instances). Rendered by emr-chart.tsx after G1's ImmunizationsCard.
- `src/components/portals/staff/emr-chart.tsx` — 2 added lines (import + `<ProgramsCard .../>`); G1
  owns the ImmunizationsCard lines above them.
- `src/components/portals/staff/ops-shared.tsx` — WoRow: `asset: {...} | null` + `titleAr?: string | null`.
- `src/components/portals/staff/ops-workorders.tsx` — added `itemCodeOf` + `AssetCell` (null-asset
  rendering: item code + "مخزون"/Store), KIND_TONE.reorder, dialog description via AssetCell.
- `src/components/portals/staff/ops-quality.tsx` — drive-by crash fix `data!.nps` → `data?.nps ?? 0`
  (pre-existing: crashed the whole staff portal for quality roles on first mount).
- `src/i18n/staff-a.ts` — appended rec.wl.* (25 keys), emr.pro.* (22 keys), status.offered,
  status.aborted (after G1's emr.imm.* block).
- `src/i18n/staff-d.ts` — ops.wo.kind.reorder + ops.wo.store (next to sibling ops.wo.* keys).
- `prisma/schema.prisma` — Waitlist.priority (+status comment), PathwayInstance.completedAt,
  WorkOrder.titleAr + optional asset relation (+kind comment |reorder). Pushed via `bun run db:push`.

## API contract (new)
- `GET /api/staff/waitlist/list` — guard module "appointments" (reception+callcenter). Rows + patient
  mini + dept, ordered PRIORITY_WEIGHT desc then createdAt asc.
- `POST /api/staff/waitlist/add` {patientId, deptCode, reasonAr?, priority?} → 201 {id} + audit.
  reasonAr stored in Waitlist.note; priority validated against PRIORITY_WEIGHT keys.
- `POST /api/staff/waitlist/offer` {id, slotAt} → waiting-only, future slot, patient double-book
  guard; first AppointmentType of dept (prefer `*-NEW`), price/duration from type, status requested,
  channel reception, first active doctor; waitlist→offered; Notification(patientId, waitlist-offer,
  sms); audit; 201 {ok, appointmentCode, appointmentId, start, priceFils}.
- `GET /api/staff/pathways/list` — can(role,"clinical"); active templates + steps.
- `GET /api/staff/pathways/for-patient?id=` — CLINICAL_VIEWERS; instances + template steps.
- `POST /api/staff/pathways/enroll` {patientId, pathwayId} — guardSign (SIGNERS∪nurse); dup active →
  409 STATE_INVALID; 201 {id, pathway, currentStep:0, status:"active"}.
- `POST /api/staff/pathways/advance` {instanceId} — guardSign; active-only; last step → status
  "done" + completedAt (currentStep = steps.length); audit before/after.
- Scheduler: `runReorderCheck()` exported — per active Item sum ok+unexpired Batches; below par +
  no open kind="reorder" WO for that item code (checklist.itemCode / titleAr regex) → WorkOrder
  (kind reorder, assetId null, priority by gap ratio ≥50% high / ≥25% normal / else low, SLA 24/48h)
  + Task(role inventory, kind reorder, refType work-order) + Notification(role inventory).

## Smoke evidence (live dev server)
- curl: waitlist add×2 → ordered emergency-first; offer → A-261020-9002 (DENT-EXAM, 12000 fils,
  requested) + SMS notif row; re-offer 409; RBAC callcenter 200 / inventory 403. Pathways enroll →
  advance 0→7 → done + completedAt; double-enroll 409; advance-after-done 409; reception 403.
- Reorder: 4 WOs auto-created on scheduler tick (ITM-DNT-0003 low, ITM-BRS-0007/ITM-SPR-0008/
  ITM-SPR-0009 high) + 4 Tasks + 4 notifications; second run created 0 (idempotent).
- agent-browser E2E: reception waitlist tab + add dialog + offer dialog (A-261020-9003 created,
  row flips to عُرض موعد); doctor chart programs card (done 7/7 instance, enroll → 1/7 chips,
  advance → 2/7). Zero browser errors.
- `bunx tsc --noEmit` 0 errors; `bunx eslint` 13 files 0 problems; dev.log clean.

## Notes for future agents
- Waitlist/PathwayInstance have NO Prisma relations (patientId/pathwayId are bare strings) — use
  manual map joins (see waitlist/list + pathways/for-patient), not include.
- WorkOrder.assetId is now nullable; any new code touching WOs must handle asset === null
  (reorder WOs). Filter reorders: `kind: "reorder"`; item code in checklist.itemCode + titleAr.
- The dev server caches the generated Prisma client — after `db:push` touch `next.config.ts` to
  force a restart, else new columns are "Unknown argument" at runtime.
- Dev-server restart runs runSchedulerTick immediately (lastReorderAt starts 0) → first reorder
  pass happens at boot.
