# Task S4 — ops sub-tab completion agent (inventory / hr / quality / reports)

## Scope delivered
Created the 4 tab files that `ops.tsx` imports (default exports, no props), following
agent 2-f's established patterns (`ops-metrics.tsx` / `ops-workorders.tsx` / `ops-fault.tsx`
+ shared atoms in `ops-shared.tsx`):

1. `src/components/portals/staff/ops-inventory.tsx` (176 lines)
   - FEFO note card (teal Alert) — dispensing follows first-expiry-first-out, see pharmacy.
   - Items table: code mono, name bi, category chip (7 cats), controlled rose chip,
     storage chip (ambient/fridge/freezer), uom, cost MoneyText, parLevel + reorderQty.
     (No stock-per-item in payload — batches carry no owner link; par/reorder shown instead.)
   - Batches table (FEFO order from server): lotNo mono, qty, expiry date + countdown chip
     (<30d red, <90d amber), status chip ok/quarantine/recalled(red+pulse)/expired.
   - Recent moves table: type chip (receipt/issue/transfer/adjust/waste/return), qty,
     from→to bin route (dir="ltr" span), reason, fmtDT.
   - All tables max-h-96 overflow-auto + sticky headers.

2. `src/components/portals/staff/ops-hr.tsx` (147 lines)
   - Explainer Alert: license expiry auto-suspends signing/prescribing (Scheduler) + 90/60/30 alerts.
   - Employees table with search filter (name/staffNo/license/role/dept): staffNo mono,
     name bi + job title, role t(`staff.role.*`), dept, license cell (number + expiry date +
     Progress bar green >90d / amber 30-90 / red <30 via literal arbitrary-variant classes
     `[&>[data-slot=progress-indicator]]:bg-*`; expired → red "signing suspended" text),
     active badge. max-h-96 overflow.
   - Facility licenses cards: kind icon (facility/lab/pharmacy/radiology/defense/insurance),
     name, kind chip, number mono, expiry date + Countdown days badge.

3. `src/components/portals/staff/ops-quality.tsx` (243 lines)
   - KPI row: NPS (sub "from n surveys"), surveyCount, open incidents, over-SLA complaints.
   - Incidents table: code, severity chip (near-miss sky / minor amber / major orange /
     sentinel red pulsing), type chip, truncated description, StatusBadge, fmtDT.
   - "بلاغ حادثة جديد" dialog: type Select (medication/fall/needle/lab/service/security),
     severity Select, description Textarea, anonymous Switch "سرية بلا لوم" →
     POST /api/staff/quality/incident → toast + reload.
   - Complaints table: code, category chip, description, StatusBadge (+amber investigating /
     teal responded tone override), SLA countdown chip red when overSla, resolutionAr.
   - CAPA list: code, actionAr, dueAt date + Countdown, StatusBadge.

4. `src/components/portals/staff/ops-reports.tsx` (114 lines)
   - KPI grid (lg:grid-cols-5 ×2): patients/appointments/encounters/revenueFils/
     collectedFils (MoneyText)/labResults/prescriptions/homeRequests/workOrders/claims
     (total + rejected % sub via ops.rep.claims.rej.v).
   - Daily revenue BarChart (recharts): X = bhDateString(date).slice(0,5), Y = fils with
     BHD3 tickFormatter, teal bars, "د.ب (فلس)" axis badge + daily.note; empty fallback.
   - Export section: PDF/Excel/CSV disabled buttons in Tooltip (span wrapper because
     disabled buttons swallow pointer events) — "watermarked + audit-logged, enable from
     settings"; small-cell suppression note card (<5 cells, privacy).

## i18n
Appended 57 keys (ar+en) to `src/i18n/staff-d.ts` (193 → 249 lines): ops.inv.fefo/count/
cat.*/storage.freezer/move.waste|return, ops.hr.search/name/license.until/alerts/fac.*,
ops.quality.open/oversla/type.lab|security/noblame/resolution/action/cat.*/surveys.count,
status.investigating/responded, ops.rep.encounters/rx/claims/axis/export.pdf|excel|csv/
export.disabled/suppress.title/suppress. Reused existing keys everywhere else.

## Verification
- `bunx tsc --noEmit`: 0 errors in my 4 files + staff-d.ts. Remaining project errors are
  other agents' pending modules only (patient screen-*, reception-queue).
- `bunx eslint` on the 4 files + staff-d.ts: exit 0, 0 problems.
- dev.log final state: no ops-* unresolved modules (only patient screen-* remain).
- DB probe (bun script): item categories {dental,consumable,lab-reagent,office,spare},
  batches ok, 19/32 employees licensed, facility licenses {facility,lab,radiology},
  incident needle/near-miss/closed, complaint waiting/assigned, capa in-progress,
  3 surveys, 1 revenue day 81.900 BHD — all match payload assumptions/i18n keys.
- Port 3000 currently down (system-managed dev server; restarts automatically); endpoints
  verified against seed data directly via Prisma.

## Constraints respected
- FORBIDDEN files untouched (only the 4 new files + staff-d.ts appended + worklog.md).
- "use client", default exports, no props, ≤250 lines/file, t()/bi() everywhere,
  StatusBadge/MoneyText/Kpi/Panel/SlaChip/Countdown/useOps reused, RTL logical props,
  sticky table headers, touch targets h-9/h-11.
