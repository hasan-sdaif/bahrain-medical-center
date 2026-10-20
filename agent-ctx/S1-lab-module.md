# Task S1 — lab & imaging module completion agent (المختبر والأشعة)

## Context for later agents
Predecessor agent 2-d was interrupted before writing the lab module. I (S1) built it
complete. Worklog entry: `Task ID: S1` in `/home/z/my-project/worklog.md`.

## Files I own (do not edit without coordination)
- `src/components/portals/staff/lab.tsx` — role-gated 6-tab shell (default export, no props)
- `src/components/portals/staff/lab-shared.tsx` — payload types, PHLEB/LAB/RAD role sets,
  `useLab` hook, `LabPanel`/`FlagBadge`/`PriorityBadge`/`AssuranceDot`, `errText`,
  `REF_RANGES` + `randInRef` (HL7 sim), `printLabel`/`LabPrintStyle`
- `src/components/portals/staff/lab-phleb.tsx` — draw worklist + 2-identifier draw dialog +
  specimen label (Code128 + .print-area print)
- `src/components/portals/staff/lab-worklist.tsx` — specimen intake (temp + reject reasons →
  red banner, doctor auto-notification)
- `src/components/portals/staff/lab-results.tsx` — entry queue (orders/list collected items) +
  result dialog w/ §17.9 autoverify panel + verify/release + HL7 analyzer sim (pre block)
- `src/components/portals/staff/lab-critical.tsx` — critical alerts, live minute counter,
  ack "قرأتُ وفهمت", escalation log timeline, 0′/10′/20′ explainer
- `src/components/portals/staff/lab-qc.tsx` — QC table + Levey-Jennings recharts (μ, ±1SD
  = 10% target, ±2SD = 20%) + new-run form (CBC/HGB/K/GLU-F)
- `src/components/portals/staff/lab-radiology.tsx` — studies table + capture dialog (patient
  search w/ demo-directory fallback for radiologist, pregnancy hard-stop, 412 → detailAr toast)
- `src/components/portals/staff/lab-radreport.tsx` — report dialog (TI-RADS size/margins/TR1-5,
  BI-RADS B0-B6, general/abdomen/renal textareas, sign) + speckle DICOM/PACS canvas
- `src/i18n/staff-b.ts` — all `lab.*` keys + module-owned `status.in-transit/analyzing/
  ordered/collected/resulted/verified/report-draft/captured` (status.captured overridden —
  imaging meaning; was unused elsewhere, verified by grep)

## Integration notes
- Role gates mirror `src/server/perm.ts`: phlebotomist sees only سحب الدم; lab-tech sees
  phleb+lab tabs; radiologist only الأشعة; med-director lab+rad (no phleb — server matrix).
- Results entry queue needs order items with status `collected` (created by phleb draw or
  seeded). New lab orders created from the EMR orders screen feed the phleb worklist live.
- QC GET returns raw `testId` (cuid) — no name/code in payload (server file out of my scope);
  table shows truncated mono id. Chart filters runs to the latest run's test.
- Analyzer sim uses client-side REF_RANGES keyed by item nameEn (fallback 1–10); all seeded
  lab order items have labTestId (DB-probed), so push + manual entry work end-to-end.
- Patients search is reception/callcenter/clinical-gated server-side → radiology capture
  falls back to `/api/patient/login-options` local filtered directory (same approach as
  billing-patient.tsx).
- `status.failed/warned/passed` NOT overridden (patient.ts semantics preserved) — QC badges
  use `lab.qc.*` keys instead. Critical alert badges use `lab.crit.st.*`.

## Verification (done)
- `bunx tsc --noEmit`: 0 errors in my files.
- `bunx eslint lab.tsx lab-*.tsx staff-b.ts`: 0 problems.
- DB probe: 2 active lab orders (1 STAT), 2 received specimens, 3 pendingResults
  (K 6.9 CRIT), 1 critical alert (new, 45min), 3 QC runs, 1 BI-RADS 4a signed study.
- Port 3000 was down (system-managed dev server) during my window — runtime smoke
  deferred to integration QA; contracts verified against server source + DB.
