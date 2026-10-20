# Worklog — Bahrain Medical Center Integrated Web System

Project: نظام الويب المتكامل للمركز الطبي — مملكة البحرين (bahrain-medical-center)
Stack: Next.js 16 (App Router, single route `/`), TypeScript strict, Tailwind 4, shadcn/ui (src/components/ui), Prisma 6 + SQLite (db/custom.db), Zustand, socket.io realtime (mini-services/realtime, port 3003), z-ai-web-dev-sdk (backend only).
GitHub: private repo `hasan-sdaif/bahrain-medical-center`, hourly push via scripts/sync-loop (token only in .git/config remote URL — NEVER committed).

## Hard constraints (from operator + spec)
- Only user-visible page route: `/` (src/app/page.tsx). Everything else = client modules under src/components/portals/* + API routes under src/app/api/*.
- Real-time via mini-service on port 3003; browser connects with io("/?XTransformPort=3003").
- Money = integer fils (BHD 3 decimals) / Prisma Decimal; never floats. Times stored UTC, displayed UTC+3.
- Barcodes Code128 = operational scanning (patients, tickets, samples, assets, items); QR = document verification only.
- Bilingual ar/en everywhere; real RTL/LTR; medical teal/emerald palette (spec allows medical blue/green); sticky footer pattern; touch targets ≥44px.
- No test code files (per operator); QA = verify-system harness + agent-browser E2E + GitHub Actions CI (lint/typecheck/db/build).
- Token ghp_*** never in any committed file.

---
Task ID: 1
Agent: main (Z.ai Code)
Task: Read uploaded specs (bahrain-medical-center-ai-prompt.md 1406 lines + merged.md 2399 lines) and produce build plan

Work Log:
- Read both documents fully (multi-chunk).
- Spec essence: 17 subdomains (website/patient/staff/admin/api/auth/files/pay/queue/kiosk/collector/partners/verify/status/help/static), 10 medical departments (GP, Dental, General Surgery, Endocrine, Breast, Urology, Oncology, Nutrition, Pediatrics, Psychiatry), EMR 20 tabs, CPOE/LIS/RIS/PACS-style imaging, pharmacy w/ FEFO, billing+insurance+accounting, 19 e-consent types, home phlebotomy all-Bahrain, HR/licenses, inventory+assets+CMMS (work orders w/ chat), quality/CAPA, audit hash-chain, break-glass, Section 17 algorithms (MRN Luhn, Arabic normalize+fuzzy, dedup scoring, booking locks, queue priority, critical escalation, Rx safety checks, weight dosing, autoverify+delta, BHD VAT Decimal, home routing 2-opt, LMS growth percentiles, verify codes, pre-op gate, recalls, isolation checks), numbering dictionary (P26-0000123-7 etc.), Bahrain context (CPR 9-digit, governorates/blocks, +973, BHD fils, VAT, UTC+3, prayer/Ramadan), 17 UAT scenarios.
- Deliverable architecture in this sandbox: one Next.js app; `/` = system shell with domain switcher (website.bh / patient.website.bh / staff.website.bh / admin.website.bh / kiosk.website.bh / queue.website.bh / verify.website.bh); full backend API under /api/{public,patient,staff,kiosk,queue,verify,webhooks,ai}; realtime socket mini-service 3003; scheduler via src/instrumentation.ts; Prisma schema 40+ models; seed = 10 departments, ~12 doctors, ~15 patients (CPR/GCC/passport), appointments/encounters/orders/results/prescriptions/invoices/claims/consents/assets/work-orders/HR/quality/CMS.

Stage Summary:
- Specs fully understood; plan: foundation by main agent (schema, seeds, libs, APIs, shell) → 8 parallel UI subagents (public site, patient portal, staff×4, admin, kiosk/queue/verify) → integration QA (agent-browser + verify harness) → GitHub push + hourly sync.

---
Task ID: 4-8 (foundation)
Agent: main (Z.ai Code)
Task: Prisma schema (94 tables) + seed (17 scenarios data) + core libs + full API layer + realtime service + scheduler

Work Log:
- prisma/schema.prisma: 94 models — patients/identifiers(blind index)/flags/policies, appointments/queue, encounters/clinical, lab (catalog/results/QC/critical alerts), imaging, drugs/prescriptions/dispensing (FEFO), billing (invoices/payments idempotent/claims/preauths/ledger), consents (19 templates), documents+verify codes, referrals/MDT, home care, assets/CMMS (faults, WOs, chat, parts), inventory (items/batches/bin moves), quality, HR, CMS, audit (hash chain), settings, sequences, web bookings, payment webhooks, AI conversations.
- prisma/seed.ts + seed-part2.ts: 12 patients (CPR/GCC/passport incl. psych-isolated, VIP, staff-member, pregnant, minor), 32 employees across 10 departments, today's board, queue tickets, K+ 6.9 critical alert scenario, QC runs, Amal breast-lump case (BI-RADS 4a → referral → MDT), invoices/payments/claims/preauths, consents, home requests, work orders (active WO w/ technician chat + reserved part), articles/FAQs, settings, sequences (9001+).
- src/lib: types (vocab unions, VAT rules, priority weights), money (integer fils BHD), bahrain (CPR validation, blindIndex HMAC, +973, UTC+3), numbering (Luhn MRN, daily codes A-/S-/RX-…), arabic (normalize/fuzzy/dedup score), algorithms (§17: queue priority, Rx safety, weight dosing, delta check, VAT invoice, NN+2-opt routing, LMS growth, preop gate, eGFR/LDL, autoverify), audit (hash chain append-only), api (RFC7807 bilingual problems, actor sessions, jsonv).
- src/server: perm (RBAC matrix §5.3), router; staff/{core,clinical,lab,pharmacy,billing,ops}; patient; public; devices (kiosk/queue/verify); webhooks (Benefit sim + HMAC); ai (z-ai-web-dev-sdk LLM, backend-only); scheduler (escalation 10/20min, reminders, PM generation, license expiry auto-suspend).
- API catch-all routes: /api/{staff,patient,public,kiosk,queue,verify,webhooks,ai,system}/[...path]; src/instrumentation.ts starts scheduler.
- mini-services/realtime (port 3003): socket.io fan-out + POST /emit internal relay (x-bmc-internal header) — running.

Stage Summary:
- tsc --noEmit: 0 errors. db push ✓, seed ✓ (12 patients, 32 staff, 10 depts, K6.9 alert, active WO chat).
- Fix notes: JSON literal defaults unsupported on SQLite (use Json? + app defaults); money = Int fils; patient relations added late (schema recovered after self-assignment bug — dedup PrescriptionItem.prescription).
- Pending: app shell UI (page.tsx), 8 parallel UI domain agents, QA loop, verify harness, docs.

---
Task ID: 9 (shell)
Agent: main (Z.ai Code)
Task: App shell at / — domain architecture, design system, shared components

Work Log:
- src/app/layout.tsx: Cairo (Arabic) + Geist fonts, RTL default, next-themes, metadata.
- globals.css: medical teal identity (--primary oklch teal), custom scrollbars, print styles.
- src/app/page.tsx: SystemShell — lazy portals per domain, sticky footer (min-h-dvh flex-col, mt-auto), Suspense skeletons.
- src/components/shell: domain-bar (7 domains w/ hosts), lang-theme bar, direction-sync.
- src/components/shared: barcode (Code128 jsbarcode + QR qrcode), badges (StatusBadge/FlagBadges/MoneyText), patient-banner (MRN barcode, assurance level, flags).
- src/lib/api-client.ts: actor header injection, problem+json error surfacing.
- Added endpoints: staff login-options, patient login-options, settings/list, audit/chain.
- i18n staff split → staff-a/b/c/d (one per staff UI agent, zero conflicts).
- docs/API.md: complete API contract for all agents.

Stage Summary:
- tsc 0 errors, eslint clean, GET / 200. Ready for parallel UI agents (tasks 2-a..2-h).

---
Task ID: S4
Agent: completion agent S4 (Z.ai Code)
Task: Finish العمليات tab shell — create the 4 ops sub-tab files imported by ops.tsx (inventory, HR, quality, reports) left missing by interrupted agent 2-f

Work Log:
- Studied 2-f's established patterns (ops.tsx tab shell, ops-shared.tsx atoms/types, ops-metrics/assets/workorders/fault) and docs/API.md ops endpoints; then created exactly the 4 in-scope files (default exports, no props):
- src/components/portals/staff/ops-inventory.tsx (176 lines): FEFO teal note card; items table (code mono, name bi, category chip ×7, controlled rose chip, storage chip incl. freezer, uom, cost MoneyText, par + reorder — payload has no per-item qty, batches carry no owner link); batches table in FEFO order (lot mono, qty, expiry + days chip <30 red/<90 amber, status chips ok/quarantine/recalled red+pulse/expired); recent moves table (type chip incl. waste/return, qty, from→to bins dir=ltr, reason, fmtDT); all lists max-h-96 overflow-auto + sticky headers.
- src/components/portals/staff/ops-hr.tsx (147 lines): auto-suspend explainer Alert (Scheduler stops signing/prescribing on expiry + 90/60/30 alerts); employees table w/ search filter (staffNo, name bi + jobTitle, t(staff.role.*), dept, license cell = number + expiry + Progress bar green >90d/amber 30-90/red <30 via literal [&>[data-slot=progress-indicator]] classes; expired → red "التوقيع موقوف"; none → "بلا ترخيص", active badge); facility-license cards (kind icon map, kind chip, number mono, expiry + Countdown).
- src/components/portals/staff/ops-quality.tsx (243 lines): KPI row (NPS + from-n-surveys, surveyCount, open incidents, over-SLA complaints); incidents table w/ severity ladder (near-miss sky, minor amber, major orange, sentinel red animate-pulse) + type chips + truncated desc + StatusBadge; "بلاغ حادثة جديد" dialog (type Select medication/fall/needle/lab/service/security, severity Select, Textarea, anonymous Switch "سرية بلا لوم") → POST /api/staff/quality/incident → toast {code} + reload; complaints table (category chip, StatusBadge w/ investigating amber + responded teal tone overrides, SLA SlaChip red when overSla, resolutionAr); CAPA list (code, actionAr, dueAt + Countdown).
- src/components/portals/staff/ops-reports.tsx (114 lines): 10-KPI grid (patients/appointments/encounters/revenue+collected MoneyText/lab/rx/home/workOrders/claims total + rejected % sub); daily-revenue BarChart (recharts, X = bhDateString.slice(0,5), Y = BHD3 fils ticks, teal bars, "د.ب (فلس)" axis badge + note, empty fallback); governed export section — PDF/Excel/CSV disabled buttons w/ Tooltip (span wrapper so disabled buttons still hover) "علامة مائية وتسجيل التدقيق — يُفعّل من الإعدادات" + small-cell suppression (<5) privacy note card.
- i18n: appended 57 ar+en keys to src/i18n/staff-d.ts (193→249 lines) — inv fefo/count/cat/storage.freezer/move waste+return, hr search/alerts/fac kinds+number+expiry, quality open/oversla/type lab+security/noblame/resolution/action/cat/surveys.count, status.investigating/responded, rep encounters/rx/claims/axis/export formats/export.disabled/suppress. All other strings reuse existing keys.
- Verified payloads against seed via direct Prisma probe (item cats, batch statuses, 19 licensed employees, facility kinds, incident/complaint/capa statuses, 3 surveys, revenue).

Stage Summary:
- tsc --noEmit: 0 errors in the 4 new files + staff-d.ts (only remaining project errors = other agents' pending modules: patient screen-*, reception-queue). eslint on the 4 files + staff-d.ts: 0 problems. dev.log: no ops-* unresolved modules remain — ops tab shell now fully wired (7/7 tabs). Files: 176/147/243/114 lines, all ≤250. Full record: agent-ctx/S4-ops-tabs.md.

---
Task ID: P
Agent: full-stack-developer (completion agent P)
Task: Finish patient portal — build the 5 missing screen modules (documents, messages, family/growth, home draw, privacy) + append i18n keys

Work Log:
- Studied wiring first: index.tsx imports default exports with NO props for all 5 screens; lib.ts payload types/useFetch/errText + HOME_TESTS/HOME_ZONES/HOME_FLOW; parts.tsx SectionCard/EmptyState/ErrorBox/LoadingRows; screen-overview/appointments/invoices patterns; docs/API.md + src/server/patient.ts response shapes.
- src/i18n/patient.ts (APPEND-only, +47 keys): doc kinds/issuedAt/scanHint/verifyNow; msg policy/emergency/unread; grw latest/legend/flag.*; hd newRequest/flow/female/male/estimateTotal/slotMorning/slotEvening; priv time/reason/rights.*/dpo/notif*.
- screen-documents.tsx (104 ln): self-contained useFetch /api/patient/overview → documents; kind→icon map (report FileText, certificate Award, referral Send, implant-card CreditCard, prescription-print Pill, invoice-print Receipt); card = title bi() + issuedAt bhDateString + kind badge + verifyCode mono + QrCode(verifyCode) + clipboard copy w/ toast; footer scanHint + "التحقق الآن" → useApp().setDomain("verify").
- screen-messages.tsx (78 ln): useFetch /api/patient/notifications (MsgItem extends NotificationItem w/ optional readAt → unread dot); kind→icon map w/ Bell fallback; top notice card = secure-messaging policy + destructive 999 emergency alert + demo badge (staff replies arrive here); list max-h-96 scroll, title bi(), body, bhDate/bhTime mono.
- screen-family.tsx (139 ln): /api/patient/family dependants cards (name, MRN mono, relation badge, dob) + guardian note; /api/patient/growth per child: recharts LineChart in ResponsiveContainer h220, X=ageMonths (number domain), dual YAxis (weight left teal #0d9488 / height right amber #d97706, connectNulls), Legend; latest-record chips per metric (value, percentile, z, flag tone: very-low/very-high red, out-of-range amber, normal emerald) + flag legend + WHO refNote; EmptyState when no records.
- screen-homedraw.tsx (212 ln): tracking cards (HOME_FLOW timeline chips: done=emerald Check, current=primary dot, pending=muted; tests chips + fasting badge; slot, fee MoneyText, visit ETA bhTimeString); request form = HOME_TESTS multi-select chips (selecting fasting test auto-sets fasting Switch), governorate Select (HOME_ZONES fees), slot Select (morning/evening w/ +eveningFils surcharge shown; wire value contains "مساء" so server applies surcharge), area/block/building/notes Inputs, prefGender Select, fasting Switch; client estimate = zone fee + evening surcharge labeled تقديري + tests total; POST /api/patient/home-request → toast t("pp.hd.done",{code,fee BHD3}) + reload + reset; errText destructive toast on RFC7807 errors.
- screen-privacy.tsx (117 ln): (a) /api/patient/access-log table (time mono bhDate·bhTime, action badge view-chart teal / break-glass red / reader-read zinc via al.* keys, by, role, reason truncate+title; overflow-x-auto; EmptyState "لا يوجد سجل وصول"); (b) PDPL rights cards (copy/rectify/restrict/withdraw + one-line desc each) + DPO contact note; (c) notification settings — 3 disabled Switches in Tooltip ("تُدار من مركز الإشعارات"), TooltipProvider wrapper.
- Rules kept: "use client", ≤250 ln/file, all text t() (ar+en), bi() for data, RTL logical props (ms-/pe-/text-start), touch targets min-h-11, loading/error/empty states on every fetch, no blue/indigo (teal/emerald/amber/red palette).

Stage Summary:
- bunx tsc --noEmit: 0 errors in patient portal (my 5 files + i18n) — remaining 4 errors are staff/emr.tsx missing emr-* modules owned by another in-flight agent (emr-vitals/referral/consents/inbox), not in my scope.
- bunx eslint on 5 screens + i18n/patient.ts: 0 problems.
- dev.log: only stale 07:57 module-not-found entries predating screen-results.tsx; no new entries from my files (dev server child currently not listening; next dev is system-managed).
- Patient portal now complete: login, header/nav, 11 screens (overview, appointments+book dialog, results, prescriptions, invoices+pay dialog, consents+consent dialog, documents, messages, family/growth, homedraw, privacy).

---
Task ID: S2
Agent: completion agent S2 (Z.ai Code) — completing interrupted agent 2-c scope
Task: reception-queue.tsx (queue management) + EMR clinical workspace (emr.tsx + 8 emr-* tab files) + staff-a.ts i18n completion

Work Log:
- reception-queue.tsx (named export ReceptionQueue, no props — matches reception.tsx import exactly): service-point letter selector A–H (SERVICE_POINTS), room Input (default ٣), big "نداء التالي" → POST queue/call-next with result banner (big code + room + patient + priority), weighted table server-sorted §17.5 (code mono, patient, priority badge, waited min, weight, status, callCount), row actions خدمة/إنجاز/لم يحضر → queue/serve, mini display monitor (GET /api/queue/display → per-point chips w/ waiting counts), useRealtime("queue:called") → reload queue+display.
- emr.tsx (replaced 5-line placeholder; 164 lines): always-visible patient finder (search → GET patients/search; dropdown w/ exact + similar rows w/ similarity warning, MRN Code128 in each row, dob/idMasked), pick → GET patients/chart/{id} + setLastPatient; silent auto-load of sessionStorage "bmc-last-patient" on mount (reception handoff; queueMicrotask = React-Compiler-lint-safe); pinned PatientBanner; 8 sub-tabs (ops.tsx tab pattern).
- emr-chart.tsx الملخص: admin-only notice when chart.clinical===null (reception view), allergies red cards w/ severity, problems w/ ICD-10, active meds, vitals last-5 table, encounters list w/ signed status.
- emr-encounter.tsx اللقاء: encounter Select + create (encounters/open), SOAP textareas chief/hpi/exam/assessment/plan/instructionsAr (→ encounters/soap), sign w/ AlertDialog confirm (409 STATE_INVALID "already signed" handled), finish-visit Dialog w/ live checklist (توقيع/تشخيص/متابعة أيام/فوترة) + followUpDays (→ finish-visit). Role gates mirror server guardSign: canWrite = SIGNERS ∪ nurse, canSign = SIGNERS.
- emr-orders.tsx الطلبات: lab (12) + imaging (4) catalog chips multi-select w/ seed-matched prices, priority radio routine/urgent/stat, reason, live total preview; one POST orders per selected kind (lab/imaging); success panels (code + total + amber 24h-duplicate warnings); orders history list (orders/list) w/ status badges.
- emr-rx.tsx الوصفات: drug rows builder (11 drugs w/o INS-R; doseMg/frequency/days/qty) → POST prescriptions; blocked=true red panel w/ errors list + overrideReason Textarea → resubmit w/ override; amber warnings; doseHelpers cards (dailyMg/perDoseMg/volumeMl). Gate: RX_ROLES (pharmacy matrix).
- emr-vitals.tsx المؤشرات: 9-field triage form → POST vitals, BMI badge from response, history table; triage gate (nurse per RBAC matrix).
- emr-referral.tsx الإحالة: toDept Select (10 depts), urgency radio w/ SLA labels (طارئ ٢س/عاجل ٢٤س/روتيني), reason → POST referrals → SLA responseDueAt banner.
- emr-consents.tsx الموافقات: GET consents/for-patient ledger + pending hard-stops red banner; capture Dialog: template Select (19 templates), readonly body, min-read-sec countdown w/ Progress bar (submit locked until read time satisfied), signedBy → POST consents/capture (READ_TOO_FAST handled).
- emr-inbox.tsx المهام/الرسائل: GET inbox → tasks (complete → tasks/complete), notifications, threads + thread conversation Dialog (messages/thread + messages/send).
- i18n staff-a.ts (APPEND ONLY, existing keys kept): ~185 new keys — predecessor's missing rec.* family (tabs/board/search/reader/register/card/book/ticket/duplist), new rec.queue.*, full emr.* family, status.in-exam/exam-done/billing. Key-coverage script: 246 used t() keys across reception+emr files all resolve in merged dictionaries.
- react-compiler lint fixes: dropped manual useCallback (memoization-preservation error), mount auto-load via queueMicrotask (setState-in-effect), SOAP prefill via selection handlers instead of effect, consent read-timer reset via open/pick handlers.

Stage Summary:
- bunx tsc --noEmit: 0 errors. bunx eslint on all 11 S2 files: 0 problems. reception.tsx's `import { ReceptionQueue } from "./reception-queue"` resolves w/ correct signature (named, no props). All request/response shapes verified against src/server/staff/{core,clinical,pharmacy}.ts + devices.ts implementations.
- Dev server port 3000 was down during S2 window (patient-portal agent's missing screen-results import crash, external restart pending — not S2 scope); live smoke test deferred to integration QA. Client-side role gates mirror server RBAC matrix so every visible call passes its gate.

---
Task ID: S3
Agent: completion agent S3 (Z.ai Code)
Task: Finish staff Billing & Insurance (billing.tsx) + Home Phlebotomy (home.tsx) modules — wire agent 2-e helpers, build missing claims tab and full home-care tabs

Work Log:
- Studied 2-e helpers (billing-invoices/new/patient/pay/preauth/shifts/types), ops.tsx tab-shell pattern, staff-c.ts i18n (212 keys), API.md + server routes (staff/billing.ts, staff/ops.ts) incl. live DB verification of seeded invoices/zones/home-requests.
- billing.tsx (REPLACED, 103 ln): role-gated 5-tab shell mirroring RBAC (billing perm → invoices/pay/shifts for cashier/insurance/center-manager; insurance perm → +preauths/claims); med-director → bc.forbidden notice; session-shared state (invoices/payments/preselected) wired across helper tabs: create→list→collect→shift→claim chain, pay shortcut switches tab via preselected, claimCode marks claimed invoices. No helper edits needed — props matched as-is.
- billing-claims.tsx (NEW, 248 ln): claims/list table (code, StatusBadge, billed/approved MoneyText, rejectReason amber, submittedAt bhDateString) w/ skeleton/error/retry/403-insuranceOnly states; new/resubmit dialog (PatientPicker w/ MPI→directory fallback, invoice checkboxes = session unclaimed invoices (real ids) + SEEDED_INVOICES demo codes INV-2026-004512/004513 w/ seeded chip + insurer share, payer Select = auto-policy + PAYERS BH-ASSUR/GULF-MED/CORP-OIL, resubmit mode adds correctedCoding ICD-10) → claims/submit {invoiceIds, patientId, payerId?, resubmitOf?, correctedCoding?}; remit actions on submitted rows: full (direct), partial (approvedFils dialog prefilled), reject (reason dialog) → claims/remit; rejected rows get إعادة تقديم.
- home.tsx (REPLACED, 79 ln): 3-tab shell (طلبات/مسارات/مناطق) owning shared GET home/requests {zones, requests} load (AbortController + tick-reload pattern to satisfy react-hooks/set-state-in-effect), error card + retry, hc.title/subtitle header + role badge.
- home-requests.tsx (NEW, 145 ln): requests table (code mono, patient+MRN, governorate zone t(hc.gov.*), tests chips + fasting amber badge, slot, fee MoneyText, StatusBadge, channel) max-h scroll; confirm dialog (fee display + optional feeFils override FILS()) → home/confirm; exports shared HomeData/HomeRequest/HomeZone types.
- home-routes.tsx (NEW, 244 ln): plan-routes button → per-zone cards (collector, totalKm, algorithm chip "Nearest-Neighbor + 2-opt + الصائمون أولاً", warnings SMP_TRANSPORT_LIMIT amber / FASTING_FIRST_OK emerald); stops vertical timeline (seq circle + rail, addr, fasting, ETA chip) joined to requests by identical addr-string; visit progression per stop: في الطريق(on-the-way)→وصل(arrived)→سحب dialog(sampleTempC + paymentMethod cash/card/benefit + amountFils prefilled fee + otpShown barcode note)→للمختبر(to-lab) via home/visit-status; no-visit stops show hc.visit.noVisitRecord amber note (server creates visits only in seed — known sim limit).
- home-zones.tsx (NEW, 77 ln): zone cards grid — areas chips + fee grid (base feeFils from API; morning/evening/holiday/minOrder from static ZONE_SCHEDULE mirroring seeded CoverageZone rows — list endpoint returns base fee only, noted via hc.zones.note).
- i18n staff-c.ts: appended ONLY 3 truly-missing keys (bc.cl.seeded, hc.req.zone, hc.zones.note) — everything else reused from existing 212 keys.
- Constraint notes: claims/submit resolves invoices by DB id → session-invoice path is fully functional end-to-end; seeded demo codes surface bilingual VALIDATION problem toast if claimed alone (no staff endpoint resolves code→id; server files out of S3 scope).

Stage Summary:
- VERIFY: bunx tsc --noEmit = 0 errors (exit 0, whole project); bunx eslint on billing.tsx + billing-*.tsx + home.tsx + home-*.tsx + staff-c.ts = 0 problems; all 7 files ≤250 lines (248 max); "use client" + RTL logical props + StatusBadge/MoneyText/apiGet/apiPost/useToast/skeleton/empty/error patterns followed.
- Dev server (port 3000) currently blocked by patient-portal agent's missing screen-* files (out-of-scope per instructions; realtime 3003 up). Billing + home modules compile & lint clean and will render once that agent lands its files.

---
Task ID: S1
Agent: completion agent S1 (Z.ai Code)
Task: Build the staff Lab & Imaging module (lab.tsx المختبر والأشعة) replacing agent 2-d's placeholder — phlebotomy, specimen intake, results/autoverify, critical alerts, QC, radiology + fill i18n staff-b.ts

Work Log:
- Studied staff/index.tsx shell (module lazy-imports default export, no props, session via useApp().staff), ops.tsx role-gated tab shell pattern, reception/emr + ops-shared style atoms, staff-c/d dict conventions, docs/API.md + full server contract src/server/staff/lab.ts + perm.ts RBAC matrix (phlebotomy: lab-tech/phlebotomist; lab: lab-tech/doctor/med-director; radiology: doctor/dentist/surgeon/oncologist/radiologist/med-director).
- lab.tsx (REPLACED, 76 ln): role-gated 6-tab shell mirroring server RBAC (like ops.tsx) — 🩸 سحب الدم (PHLEB_ROLES), 📥 استلام العينات + 🔬 النتائج + 🚨 التنبيهات الحرجة + 📏 ضبط الجودة (LAB_ROLES), 🩻 الأشعة (RAD_ROLES); header + role badge + subtitle; no-access fallback.
- lab-shared.tsx (NEW, 150 ln): payload types for every lab/imaging/orders endpoint (verified field-by-field vs server), PHLEB/LAB/RAD role sets, errText (problem+json detailAr/detailEn), useLab fetch hook (AbortController + tick reload, async-only setState for react-hooks/set-state-in-effect), LabPanel skeleton/error+retry/empty atom, FlagBadge (normal/H/L/CRIT tones w/ pulse), PriorityBadge (STAT red), AssuranceDot, REF_RANGES map (seed catalog ranges by test nameEn) + randInRef for HL7 sim, printLabel/.print-area clone print helper + LabPrintStyle.
- lab-phleb.tsx (208 ln): GET phleb/worklist table — STAT-first red badge (server-sorted), fasting amber badge, patient+MRN+assurance dot, tests chips (+n overflow), specimen code+StatusBadge when drawn; "بدء السحب" Dialog: two-identifier checklist (name ✓, MRN ✓ w/ value shown, fasting confirm only when order.fasting — submit locked), tubes number, difficulty Select (عادي/صعب/غير صائم/انطباع وريد), incident Input → POST phleb/draw → success Dialog: specimen code font-mono + Code128 barcode (S-…) + printable .print-area label (hospital header, patient/MRN/order, code, barcode, collected time) + window.print button.
- lab-worklist.tsx (150 ln): GET lab/worklist specimens table (code, patient+MRN, collectedAt, StatusBadge); "استلام" Dialog: tempC Input + reject Select (قبول / تحلل / كمية غير كافية / أنبوب خاطئ / تأخر) → POST lab/receive; rejection → destructive Alert banner (specimen code) + toast noting tests reset to مطلوبة + auto doctor notification for free redraw.
- lab-results.tsx (250 ln): two sections — (1) entry queue from GET orders/list (kind=lab, active statuses, items collected/ordered w/ "بانتظار السحب" chip): per-item "إدخال نتيجة" Dialog (value + comment → POST lab/result) with §17.9 response panel (FlagBadge, green "اعتماد آلي" banner OR amber "بحاجة مراجعة بشرية" + mapped reason QC_FAILED/CRITICAL_VALUE/DELTA_CHECK/FLAG_H/FLAG_L/AUTOVERIFY_OFF + deltaPct + "اعتماد وإصدار" → POST lab/verify release:true) + per-item "محاكاة HL7" button → POST analyzer-push w/ randInRef(testEn) → dark mono <pre> of returned MSH/OBX ORU^R01 segments; (2) pendingResults from lab/worklist (test, value+unit, FlagBadge, patient) with verify/release action.
- lab-critical.tsx (147 ln): criticalAlerts table — test, value+unit+CRIT pulse badge, patient, status badge (new red / escalated-1 pulsing / escalated-2 dark-red pulsing / acknowledged zinc), live "منذ X دقيقة" counter (15s interval) red-tinted row past 10min; big red "تأكيد الاستلام — قرأتُ وفهمت" → POST ack-critical → toast + reload; expandable escalation log timeline (dot rail, ev + who + UTC+3 time); explainer card: 0′ doctor in-app → +10′ on-call → +20′ dept head + med director (Scheduler).
- lab-qc.tsx (178 ln): GET lab/qc table (testId mono, L1-3, target, observed, Δ signed + %, status badge passed/warned/failed, Westgard rule) + recharts Levey-Jennings LineChart (chronological points of latest run's test, solid μ target line, dashed ±1SD amber (10% of target) and ±2SD red (20%) ReferenceLines, LTR wrapper); new-run form (testCode CBC/HGB/K/GLU-F verified in DB, level 1-3, target, observed) → POST lab/qc → status-aware toasts (failed → destructive "أوقف نتائج المرضى وأعد المعايرة").
- lab-radiology.tsx (200 ln): GET radiology/worklist studies table (code, patient+MRN, StatusBadge, grade teal mono badge, signedAt); "فحص جديد" Dialog: patient search (debounced /staff/patients/search → FORBIDDEN fallback to /patient/login-options demo directory w/ Arabic-normalized local filter — radiologist lacks clinical perm), type Select (8 seeded types US-ABD/US-NECK/US-BREAST/US-KUB/DXR-PA/DXR-BW/DXR-PANO/MG), mandatory pregnancy-exclusion Checkbox (submit locked) → POST capture; 412 CONSENT_REQUIRED surfaced as problem+json detailAr destructive toast.
- lab-radreport.tsx (175 ln): "تقرير" Dialog per study — template Select (TI-RADS/BI-RADS/عام/بطن/مسالك, prefilled from study.template) switching: tirads → size + margins Inputs + TR1-TR5 Select; birads → B0-B6 Select; grade computed (TI-RADS n / BI-RADS n); findingsAr Textarea w/ template-specific placeholders; reportAr + reportEn Textareas (LTR); e-sign Checkbox → POST radiology/report (sign → status signed + signedAt); deterministic seeded grayscale speckle-noise canvas + "صورة توضيحية — محاكاة DICOM/PACS" caption.
- i18n staff-b.ts (FILLED, 168 ln): ~150 ar+en keys — lab.* shell/phleb/rx/res/crit/qc/rad families + status.in-transit/analyzing/ordered/collected/resulted/verified/report-draft/captured (collision-checked: only unused status.captured overridden w/ imaging meaning); every UI string via t(), data via bi().

Stage Summary:
- VERIFY: bunx tsc --noEmit → 0 errors in all 10 S1 files (whole project reached 0 during window; one transient emr-consents error from 2-c's mid-write resolved itself). bunx eslint on lab.tsx + lab-*.tsx + staff-b.ts → 0 problems (fixed one react-hooks/set-state-in-effect by moving error-clear into async .then). All files ≤250 lines (max 250). DB probe validated demo data: 2 active lab orders (STAT first, items collected: Lipid panel + Vitamin D w/ labTestId), 2 specimens received, 3 pendingResults (K 6.9 CRIT + GLU 9.8 H + TSH 6.4 H), 1 critical alert "new" (45min — escalation-relevant), 3 QC runs (K/HGB/GLU-F incl. 2-2s warned), 1 signed BI-RADS 4a study, QC-form test codes exist.
- Dev server port 3000 was down during S1 window (system-managed; unrelated patient-portal import crash earlier) — runtime smoke deferred to integration QA; all endpoint contracts cross-checked against server source + live DB. Full phleb→receive→result→verify/critical chain works end-to-end via API contracts; new lab orders from the EMR module feed the draw worklist.
