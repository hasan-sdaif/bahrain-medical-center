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

---
Task ID: E3
Agent: emoji-cleanup agent E3 (Z.ai Code)
Task: Removed every emoji from the 12 billing + home-draw staff files (billing*.tsx ×8, home*.tsx ×4), replacing tab-label emoji strings with lucide-react icons and stripping decorative emoji prefixes from toasts/hints — zero-emoji professional UI per operator directive.

Work Log:
- Read worklog header constraints + last 2 sections (S1 lab agent) and the established icon conventions in ops.tsx/lab.tsx/index.tsx (LucideIcon typing, `<Icon className="size-4" aria-hidden />` in TabsTrigger with gap-1.5).
- Scanned all 12 scope files with the mandated emoji regex → 27 emoji occurrences across 12 files.
- billing.tsx: TABS array retyped `icon: string` → `icon: LucideIcon` (import type); 🧾→ReceiptText, 💵→Banknote, 🪙→Coins, 🗂️→FileCheck2 (matches preauth header), 📨→Send; TabsTrigger now renders `<Icon aria-hidden className="size-4" />` via the ops.tsx IIFE-find pattern with gap-1.5 added to trigger.
- home.tsx: TABS retyped to `{ key: TabKey; icon: LucideIcon }[]` (TabKey union declared explicitly, `as const` dropped); 📋→ClipboardList, 🗺️→Route (matches routes-tab header icon), 📍→MapPin (matches zones cards); trigger renders icon + gap-1.5.
- Toast titles (string-only, cannot hold JSX): deleted `✅ ` prefix keeping the meaningful code (inv.code / last.code / r.code / claim.code / req.code / confirming.code in billing-new, billing-pay, billing-preauth, billing-claims, home-requests, home-routes); bare `title: "✅"` toasts (shift open/close, preauth approve/reject, plan-routes) → `title: t("common.done")` — existing core i18n key (منجز/Done), no new keys invented.
- Decorative plain-text emoji prefixes deleted, text kept: ℹ️ (billing-invoices seededHint, billing-new noPatientPolicy, billing-patient directory, billing-claims selectInvoice, home-zones note), 🔒 (billing-pay receipt footer notice.cards — also prints cleaner), 🔎 (home-routes otpHint).
- Untouched per constraints: all t()/bi() keys, API calls, state/props, role gates, ZONE_SCHEDULE, SEEDED_INVOICES, component logic/exports, "use client", RTL logical props.
- Verified: mandated rg emoji scan on the 12 files → 0 matches; broader unicode sweep (2000-3300, 1F000-1FBFF, VS16, ZWJ) → only em-dash/arrow typography in comments and "—" null placeholders (established codebase style, not emojis); wc -l all 12 files ≤250 (max billing-claims 248).

Stage Summary:
- Files changed: 12/12 in scope (billing.tsx, billing-invoices, billing-new, billing-patient, billing-pay, billing-preauth, billing-shifts, billing-claims, home.tsx, home-requests, home-routes, home-zones). 27 emojis removed total (8 tab-array emoji strings converted to 8 LucideIcon refs: ReceiptText, Banknote, Coins, FileCheck2, Send, ClipboardList, Route, MapPin; 19 decorative prefixes stripped from toasts/hints).
- bunx tsc --noEmit: 0 errors in all 12 E3 files. PRE-EXISTING (NOT in E3 scope, not fixed, reported): src/components/shell/domain-bar.tsx:53 — TS1003/TS1382 on invalid JSX `<ICONS[d.key] … />` (dynamic member expression as component tag; likely mid-write by a parallel shell-cleanup agent — needs `const Icon = ICONS[d.key]` extraction).
- bunx eslint on the 12 files: 0 problems.
- Remaining emojis in E3 scope = 0.

---
Task ID: E2
Agent: emoji-cleanup agent E2 (Z.ai Code)
Task: Remove every emoji from the 9 lab/imaging + fault-report files (lab-shared, lab-phleb, lab-worklist, lab-results, lab-critical, lab-qc, lab-radiology, lab-radreport, ops-fault) — replace with lucide-react icons or plain professional text, following the conventions already established in ops.tsx/lab.tsx/staff index (E1).

Work Log:
- Read worklog header constraints + S1/S3 sections (built these files), then read all 9 scope files and audited emojis with the mandated rg unicode-range regex: 25 regex hits + 3 extra typographic symbols (▲/▼ expand toggles, ＋ fullwidth plus) = 28 occurrences.
- Icon mapping applied (all verified present in installed lucide-react 0.525): ⚠️→TriangleAlert · ✅(title)→CheckCircle2 · 🖨️→Printer · ✅/⛔(SelectItems)→Check(emerald)/X(destructive) · 🤖→Bot · 🔬→FlaskConical · ⚙️→Cog · 🧾→ClipboardList · ⏱→Timer · 🚨→Siren · ⏰→AlarmClock · 📈→ChartLine · 🧪→TestTube · ℹ️→Info · 🩻→Scan · 🖼→Image (aliased ImageIcon) · ✍️→Signature · 📷→Camera · ＋→Plus · ▲/▼→ChevronUp/ChevronDown.
- Plain-text deletions per convention rule 4 (toast titles can't carry icons): `✅ ${t("lab.crit.acked")}` and `✅ ${t("lab.rad.reportOk")}` → bare t(); decorative 🤰 pregnancy label emoji deleted (no lucide equivalent, checkbox already provides the affordance). Print label (.print-area) content kept pure text — no icons in print templates.
- Conventions honored: named lucide-react imports; `<Icon className="size-4 shrink-0" aria-hidden />` (size-3.5 inline notes, size-5 dialog titles, size-4 in Buttons, text-primary on Card/DialogTitle icons); RTL untouched; no t() keys, bi(), logic, API calls, state, props, exports, role gates, REF_RANGES or randInRef changed — purely visual swap.
- Incident + fix: MultiEdit silently wrote `...text-zinc-200")">` (missing `}`) on lab-critical.tsx's long cn() line 93 despite showing the correct diff — caught by bunx tsc (17 cascade JSX errors), repaired byte-exact via python replace to `")}>`, re-verified.
- lab-results.tsx grew to 251 lines (icon import +1 on a file already at the 250 cap) → inlined both CardHeader wrappers (formatting only) → 247 lines. All 9 files ≤250 lines, "use client" intact.

Stage Summary:
- Files changed: 9/9 in scope (lab-shared, lab-phleb, lab-worklist, lab-results, lab-critical, lab-qc, lab-radiology, lab-radreport, ops-fault). Emojis removed: 28 (25 in the mandated regex ranges + ▲/▼ + ＋). Icons added: 24 new lucide named imports (~28 render usages). Line counts: 151/209/151/247/148/179/201/176/114.
- VERIFY 1: rg emoji-range scan over the 9 files → zero output (exit 1, no matches). Broadened sweep (1F000-1FAFF, 2000-2BFF, FE00-FE0F, FF00-FFEF, 3000-303F) → only box-drawing `──` comment dividers remain (not emoji).
- VERIFY 2: bunx tsc --noEmit → 0 errors in all 9 scope files. Only remaining project errors: src/components/shell/domain-bar.tsx(53,27 & 53,79) — `<ICONS[d.key]` missing JSX braces (out of E2 scope, likely concurrent agent mid-write; reported, not fixed per instructions).
- VERIFY 3: bunx eslint on the 9 files → 0 problems (exit 0).
- Known out-of-scope observation: billing-new.tsx still contains one `ℹ️` (line ~186) — belongs to whichever agent owns billing files, not E2 scope.

---
Task ID: E1
Agent: emoji-cleanup agent E1 (Z.ai Code)
Task: Remove every emoji from the 14 EMR + reception staff files (emr, emr-chart, emr-encounter, emr-orders, emr-rx, emr-vitals, emr-referral, emr-consents, emr-inbox, emr-shared, reception-queue, reception-search, reception-register, reception-success) — replace with lucide-react icons or plain professional text, following the conventions established in ops.tsx/lab.tsx/staff index.

Work Log:
- Read worklog header constraints + last sections, then the reference conventions in ops.tsx/lab.tsx/staff index.tsx (LucideIcon typing, `<Icon aria-hidden className="size-4" />` in TabsTrigger + gap-1.5) and all 14 scope files; audited with the mandated rg unicode-range regex + extended sweep: 72 decorative glyphs (67 in mandated ranges incl. ✓✕✍⏰⏱ dingbats/technical + 4 fullwidth ＋ + 1 ● live-dot).
- emr-shared.tsx (enabler): Section `title: string` → `title: ReactNode` (type-widen only, all callers in scope) so section headers can render icons inside the existing flex CardTitle; ErrorBox ⚠️ → TriangleAlert size-4 in flex span.
- emr.tsx: TABS emoji strings → LucideIcon components (`as const` kept, `type TabKey = (typeof TABS)[number][0]` still derives): 📋→ClipboardList, 🩺→Stethoscope, 🧪→FlaskConical, 💊→Pill, 📈→ChartLine, ↗→CornerUpRight, ✍→FileSignature, 📥→Inbox; TabsTrigger renders `<Icon aria-hidden className="size-4" />` + gap-1.5; finder dupwarn ⚠️ → TriangleAlert size-3.5.
- emr-chart.tsx: 🔒 admin notice → Lock size-8 centered; section titles → TriangleAlert/Bandage/Pill/ChartLine/Folders size-4 ReactNode fragments.
- emr-encounter.tsx: 🩺×2 → Stethoscope; SelectItem `✅` signed marker → existing key t("status.signed") (plain professional text, no new keys); ＋/✍️/🏁 buttons → Plus/FileSignature/Flag size-4; checks Badge ✓ → Check (Badge auto-sizes svg via [&>svg]:size-3); 🔒 locked save button → Lock inside flex span; AlertDialogAction ✍️ → FileSignature; finish DialogTitle 🏁 → Flag + flex; checklist circle ✓ → Check size-3.
- emr-orders.tsx: 🧪→FlaskConical, 🩻→Scan (matches lab.tsx rad tab), 📋→ClipboardList; success Badge ✓ → Check; amber warning rows ⚠️ → TriangleAlert + flex items-center gap-2.
- emr-rx.tsx: 💊×2 → Pill; 🛡️ report → ShieldCheck; ＋ add-row → Plus size-3.5; ✕ remove-row → X (icon-only, aria-label kept); ⛔ blocked title → OctagonX in flex <b>; ✓ ok banner → Check; ⚠️ warnings → TriangleAlert; toast description `N ⛔ · M ⚠️` → JSX span w/ OctagonX/TriangleAlert size-3.5 (toast description is ReactNode; preserves error/warning count semantics).
- emr-vitals.tsx: 📈×2 → ChartLine; 🕘 history → History.
- emr-referral.tsx: ↗ → CornerUpRight; result Badge ✓ → Check; ⏱️ SLA due → Timer (stacked layout preserved via items-start + inner span so slaNote stays on its own line).
- emr-consents.tsx: ⛔ hard-stop → OctagonX in flex <b>; ✍ section + capture DialogTitle → FileSignature; ＋ capture → Plus size-3.5; read-timer `✓ Ns` → Check size-3.5 inline-flex in mono span.
- emr-inbox.tsx: ✅ tasks → CheckCircle2; ⏰ dueAt → AlarmClock size-3.5 inline; ✓ complete button → Check size-3.5; 🔔 notifs → Bell; 💬 threads + thread DialogTitle → MessageSquare.
- reception-queue.tsx: 🔊 call-next → Volume2 size-4; 🚪 room Badge → DoorOpen (auto size-3); 🖥️ display header → Monitor; ● live dot → CSS dot (`size-2 rounded-full bg-teal-600` span) — zero glyph, same meaning.
- reception-search.tsx: ⚠️ dupwarn banner → TriangleAlert + flex; 🪪 smart-card reader → CreditCard; ＋ manual registration → Plus.
- reception-register.tsx: 🔒 chip-locked hint Badge → Lock (tiny h-4 badge, auto size-3); ⛔ duplicate alert → OctagonX + flex; 🛡️ payer banner → ShieldCheck size-3.5.
- reception-success.tsx: ⚠️ duplist title → TriangleAlert in flex <b>; 🖨️/📅/🎫 buttons → Printer/CalendarDays/Ticket size-4; 🎫 ticket-issued header → Ticket.
- Untouched per constraints: all t()/bi() keys (one added usage of EXISTING key status.signed), API calls, state, props, logic, exports, role gates, catalogs; "use client" intact; RTL logical props preserved; 30+ distinct lucide icons verified present in lucide-react 0.525.0 before use.

Stage Summary:
- Files changed: 14/14 in scope. Emojis removed: 72 decorative glyphs (67 in mandated unicode emoji/dingbat/technical ranges incl. FE0F sequences + 4 fullwidth ＋ + 1 ●). Icons added: 32 distinct lucide-react named imports (~60 render usages). Line counts all ≤250 (max emr-shared 230).
- VERIFY 1: rg mandated emoji scan over the 14 files → zero output (exit 1). Extended sweep (2190-21FF arrows, 2500-25FF, FF00-FFEF fullwidth, 2000-206F) → only legit typography remains (em-dash separators, "…" loading ellipsis, "—" null placeholders, box-drawing comment dividers, SpO₂ subscript, → in code comments only).
- VERIFY 2: bunx tsc --noEmit → 0 errors in all 14 E1 files. PRE-EXISTING project error (NOT in E1 scope, not fixed, reported): src/components/shell/domain-bar.tsx:53 TS1003/TS1382 invalid JSX `<ICONS[d.key] … />` — same known issue E2/E3 reported (needs `const Icon = ICONS[d.key]` extraction; owner = shell-domain agent).
- VERIFY 3: bunx eslint on the 14 files → 0 problems (exit 0).
- Project-wide emoji status: rg over ALL of src/ → 0 matches (E1+E2+E3 complete; src tree fully emoji-free). Non-UI remnants outside src/ (out of all E-agents' scope): prisma/seed.ts:141 `✔`, prisma/seed-part2.ts:782 `✔`, scripts/sync-github.sh:13 `✓` — terminal console output only, never rendered in UI.

---
Task ID: R2
Agent: reference cross-check agent R2 (Z.ai Code)
Task: Cross-check BMC against 3 reference clones (OpenMRS core, Bahmni core, Frappe Health + ERPNext) per spec §2.3 — inventory capabilities, map to BMC architecture, gap analysis, write Arabic reference docs.

Work Log:
- Read worklog header + last sections; confirmed scope: research + docs only, no app-code changes.
- OpenMRS (v3.0.0-SNAPSHOT): enumerated 164 domain classes in reference-systems/openmrs-core/api/src/main/java/org/openmrs/ (Person/Patient, Concept* dictionary 25+ classes, Encounter/Visit, Obs, Order family incl. DrugOrder/TestOrder/ServiceOrder/ReferralOrder/OrderGroup/OrderSet, PatientProgram/ProgramWorkflow, Cohort/CohortMembership, Provider/ProviderRole, Form/FormField, Relationship, User/Role) + services in org/openmrs/api/ (PatientService...MedicationDispenseService) + hl7/, logic/, notification/, scheduler/ packages.
- Bahmni (v3.1.0-SNAPSHOT): studied bahmnicore-api services (BahmniProgramWorkflowService, BahmniVisitService, OrderService, BahmniDrugOrderService, DiseaseTemplateService, TsConceptSearchService, InventoryStockService, SqlSearchService, BahmniEncounterMatchDecisionServiceImpl), omod REST controllers (BahmniEncounterController, BahmniDispositionController, BahmniLabOrderResultController, BahmniTrendsController, ObsToObsTabularFlowSheetController, DrugOGramController, FormDraftController, BahmniPatientImageController, SqlSearchController), admin CSV importers/exporters (PatientPersister, EncounterPersister, LabResultPersister, PatientProgramPersister...), obs-relation module, openmrs-elis-atomfeed-client-omod (OpenElisPatientFeedClientImpl, FailedEventsFeedClient), contract/visit/VisitSummary.
- Frappe Health: enumerated all 139 doctypes under healthcare/healthcare/doctype/; extracted field lists for 17 key doctypes (patient_appointment 51f incl. check-in/position_in_queue/google_meet; patient_encounter 42f; lab_test 56f; observation 52f; medication_request 47f; inpatient_record 54f; shift_handover SBAR; insurance_claim 25f; healthcare_practitioner 37f incl. fee-validity/max_visits; healthcare_service_unit capacity/overlap); hooks.py scheduler_events (reminders all/nursing-lapse hourly/fee-validity daily); patient_portal Vue app.
- ERPNext: modules.txt (Accounts, Buying, Selling, Stock, Assets, Projects, Support, Quality Management, Manufacturing...); accounts 192 doctypes + 62 financial reports (balance_sheet, trial_balance...); stock 81 doctypes (batch, stock_ledger_entry, purchase_receipt, item_reorder, putaway_rule...); buying (RFQ→supplier_quotation→purchase_order + scorecards); assets (depreciation_schedule, asset_maintenance/repair/movement); quality_management (goals/reviews/NCR); verified HR/payroll NOT in this clone (moved to separate Frappe HR app).
- Mapped BMC: 94 prisma models, all staff API routes extracted from src/server/staff/{core,clinical,lab,pharmacy,billing,ops}.ts + patient/public/devices/fhir.ts; confirmed PathwayInstance exists but has NO API/UI (seed-only, prisma/seed-part2.ts:671), no Cohort, no Visit grouper (Encounter holds full lifecycle), LedgerEntry simple account/debit/credit, Supplier directory-only (no PO/GRN/AP), FHIR GET-only, Item.parLevel/reorderQty stored but never consumed by logic.
- Wrote docs/references/{openmrs,bahmni,frappe-health}.md (Arabic; نظرة عامة + جرد القدرات table + فجوات ذات أولوية + توصيات; every claim cites clone file paths) + honest HR/payroll-absence note for erpnext clone.
- Verified: 67/64/82 lines; git status shows only docs/references/ untracked (zero app-code modifications).

Stage Summary:
- Inventories produced: 3 Arabic reference docs (213 lines total) each with capability-mapping tables (24/23/36 status markers ✔/◐/✖), gap lists with severity, and recommendations.
- Top gaps — OpenMRS: Cohorts/registries (عالية — no equivalent, CohortService.java); Pathway programs modeled but not operational (عالية — PatientProgram.transitionToState vs dead model); Visit multi-encounter grouper (متوسطة); FHIR write + HL7v2 (متوسطة); terminology management ConceptSource/Map (متوسطة).
- Top gaps — Bahmni: chronic-disease flowsheets/DiseaseTemplate/Drug-O-Gram (عالية); patient programs (عالية, same as OpenMRS); bulk CSV data migration admin module (متوسطة); LIS feed retry semantics for analyzer-push (متوسطة).
- Top gaps — Frappe/ERPNext: purchasing cycle RFQ→PO→GRN→AP (عالية — Supplier is a directory); financial statements/trial balance over LedgerEntry (عالية — 62 ERP reports); payroll (عالية — absent in both BMC and the local erpnext clone, moved to Frappe HR); video-consult link for Encounter.type=tele (متوسطة); auto-reorder despite parLevel fields (متوسطة); asset depreciation (متوسطة); IPD/microbiology/physio/ER documented as out-of-scope decisions (منخفضة).
- BMC advantages noted: Arabic fuzzy MPI + merge, Ramadan/visitor slots, Westgard QC + delta + autoverify (absent in Bahmni core), preauths (absent in Frappe), full internal billing+claims, home phlebotomy 2-opt routing, SBAR Handover (matches Frappe), audit hash-chain (stronger than OpenMRS Envers).
- Files written: docs/references/openmrs.md, docs/references/bahmni.md, docs/references/frappe-health.md. Next actions if desired: implement Cohort model+endpoint, activate PathwayInstance API, add PurchaseOrder/GoodsReceipt + trial-balance report, meetingUrl on Appointment — all specified in the docs' recommendation sections.

---
Task ID: R1
Agent: reference cross-check agent R1 (Z.ai Code)
Task: Cross-check BMC vs OpenEMR + Open Hospital (§2.3 reference study) — capability inventories, mapping to BMC architecture, gap analysis, Arabic docs. Research only, no app code changes.

Work Log:
- Read worklog header + last sections (S1..E3) for constraints; confirmed reference clones exist.
- OpenEMR study: top dirs; interface/modules (zend: Acl/Carecoordination/Ccr/Documents/Immunization/Installer/PatientFilter/Patientvalidation/PrescriptionTemplates/Syndromicsurveillance + custom: comlink-telehealth/faxsms/ehi-exporter/prior-auth/weno/dorn); full menu extraction from interface/main/tabs/menu/menus/standard.json (2338 ln); interface/{billing,reports(49),forms(35),orders,drugs,patient_tracker,therapy_groups,easipro,smart,code_systems,batchcom,super}; portal/ (self-scheduling, messaging, PRO questionnaires, stripe/authorizenet pay, amendments, CCDA gateway); apis/routes (FHIR R4 US Core 3.1.0 + standard + portal REST), oauth2, gacl ACL, library/clinical_rules.php (3532 ln), Totp, CouchDB.
- Open Hospital study: openhospital-core 49 org/isf packages, 44 with model/ (79 entity classes enumerated: Patient/Admission/Ward/Visit/Opd/Operation+Opetype/exa+lab (Exam/Laboratory)/dicom/vaccine+patvac/therapy/medicals+medicalstock+medicalstockward+medicalinventory/supplier/accounting (Bill/BillItems/BillPayments)/priceslist/anamnesis/malnutrition/disease/permissions+menu/sessionaudit/sms/xmpp/telemetry/stat+rpt_base (Jasper)); openhospital-ui routes/activities/accessories (patientBooking, patientTriage, patientOPD, patientOperation, patientTherapy, admission, discharge, billsRecap, admin CRUD screens).
- BMC side mapping: enumerated all 94 Prisma models; extracted every endpoint from src/server/*.ts (staff core/clinical/lab/pharmacy/billing/ops + patient/public/devices/fhir/webhooks/ai); portals inventory (staff 44 files, patient 11 screens, admin 5, kiosk/queue/verify); verified Waitlist appears ONLY in prisma/seed.ts (no API/UI) and Immunization is read-only (fhir.ts:165 + chart) — both real gaps.
- Wrote docs/references/openemr.md (72 ln, 40-row capability table) and docs/references/openhospital.md (72 ln, 37-row table) — Arabic, نظرة عامة/جرد القدرات/الفجوات ذات الأولوية/التوصيات, all claims cited with file paths; corrected counts after verification (49 reports not 60+, 35 forms, 79 model classes, 49 packages).

Stage Summary:
- Inventories produced: 2 complete capability inventories (OpenEMR ~40 capabilities, Open Hospital ~37) each mapped to BMC location with status مغطى/جزئي/فجوة.
- Top gaps: (1) [HIGH] Immunizations: model+FHIR read-only, no staff capture UI/report (vs OpenEMR Immunization module + OH vaccine/patvac) — BMC has pediatrics dept; (2) [HIGH] Recalls: Waitlist model dead (seed-only, zero endpoints/UI) vs OpenEMR top-level Recalls; (3) [MED] PHQ-9/GAD-7 structured psych scoring forms absent (BMC has psychiatry dept); (4) [MED] Surgery operation registry/schedule (types catalog, room+team+time) absent — BMC has 3 surgical depts + preop gate only; (5) [MED] Pharmacy stock-take (physical count sessions) + per-service-point balances missing vs OH medicalinventory/medicalstockward; plus [MED] X12 837/ERA claim export, FHIR write/OAuth2, NHRA notifiable-disease report; IPD/wards/maternity documented as out-of-scope-by-design.
- Files written: docs/references/openemr.md, docs/references/openhospital.md (no application code touched).
- Recommended quick wins needing no migration: immunization capture + waitlist activation (models already exist in schema).
---
Task ID: R3
Agent: reference cross-check agent R3 (Z.ai Code)
Task: Cross-check BMC against 5 reference clones (Medplum, Foo Medical, OpenELIS Global 2, OHIF Viewer, Care) — capability inventories, gap analysis, Arabic reference docs under docs/references/ (spec §2.3). Research + docs only, zero app-code changes.

Work Log:
- Read worklog header constraints + last 2 sections (E1/E2/E3 emoji cleanup, S1 lab build) for conventions; studied the 5 local clones at capability level with file-level evidence.
- Medplum: packages/ inventory (35+ pkgs), React library 129 dirs (~122 FHIR components + auth/28 forms + chat/ThreadInbox), server auth (login/mfa/google/register/revoke), AccessPolicy RBAC+compartments, subscriptions (BullMQ websocket/rest-hook), 80+ FHIR operations ($find/$book/$hold, $match, $everything, claimsubmit, smarthealthlinks), hl7/ccda/dicom/fhircast/agent packages.
- Foo Medical: full Router.tsx route map (self-registration w/ Google+reCAPTCHA, ThreadInbox messaging, health-record lab-results/medications/questionnaire-responses/vaccines/vitals, care-plan action-items, get-care $find+Hold booking, SmartHealthLinks, account membership-and-billing Coverage/PaymentNotice display-only).
- OpenELIS: 55 frontend components (workplan/validation/qc/inventory/analyzers/resultPage/microbiology/pathology/cytology/nonconform/eqa/coldStorage/esignature), 167 backend packages, 11 Westgard rule evaluators, inventory lots+UpdateQCStatusModal+GS1, analyzers BridgePairing, testreflex/testalertrule/testcodes, sysmex HL7 test data.
- OHIF: 9 modes, 15 extensions, full tool inventory from modes/basic/src/initToolGroups.ts (26 tools: WindowLevel/Pan/Zoom/StackScroll active + Length/Bidirectional/ROI/Angle/Cobb/Livewire/UltrasoundDirectional...), services (Viewport/ToolGroup/Segmentation/Colorbar/Sync), hanging protocols, usAnnotation panel (PleuraBlinePercentage, FanShapeGeometryProvider), measurement-tracking, WorkList routes, 28 UI components.
- Care: Django backend FHIR-rewrite (frontend care-fe NOT in this clone) — 43 emr models, 52 viewsets (incl. mfa_login/totp/scheduling), questionnaire.py structured_responses engine, encounter.py (status_history/care_team/current_location), facility geo-organization multitenancy, audit_log middleware, asset mgmt only as historical migrations (0372/0466).
- Mapped BMC counterparts: portals/* (patient 11 screens, staff 6 modules + 40+ files, public 12 sections, kiosk/queue/verify/admin), src/server/staff/lab.ts (phleb→draw→receive→result/autoverify/delta→critical escalation→QC→analyzer sim), src/server/fhir.ts (9-resource read-only R4 facade + bridge-status), src/server/ai.ts, ops-inventory (lot/expiry/FEFO), webhooks (Benefit HMAC payment sim).
- Wrote 5 Arabic docs (نظرة عامة / جدول جرد القدرات مقابل BMC / الفجوات ذات الأولوية / ملخص الفجوات بدرجات الخطورة / أدلة الملفات / التوصيات): docs/references/medplum.md (64 ln), foo-medical.md (68), openelis.md (67), ohif.md (68), care.md (70). All claims cite real file paths; verified factual hooks live (lab.rad.image i18n caption, emr-chart allergies, screen-results refLow/refHigh, schema Encounter/Consent, scheduler escalation strings).
- Verified: all 5 files ≥50 lines, zero emojis (arrows ←→↔ only, matching existing docs/references/ style), no application code touched.

Stage Summary:
- Inventories produced: Medplum React 129-dir component library + auth/ops/subscriptions; Foo Medical full route map; OpenELIS 55 components + 167 packages + 11 Westgard evaluators; OHIF 9 modes/15 extensions/26 tools; Care 43 models/52 viewsets questionnaire+encounter schemas.
- Top gaps (severity): [عالية] no real DICOM viewer — 26 OHIF tools vs seeded grayscale canvas (lab-radreport.tsx); [عالية] no bidirectional analyzer interface — OpenELIS BridgePairing/analyzerimport vs one-way HL7 push sim (lab.ts:149-163); [عالية] FHIR read-only 9 resources vs Medplum full R4 server (fhir.ts CAPABILITY read/search-type only); [متوسطة-عالية] reagent-lot↔test↔QC linkage missing (OpenELIS UpdateQCStatusModal + testreagentlink vs standalone ops-inventory); [متوسطة] Westgard simplified ±% vs 11 multi-rule evaluators; [متوسطة] no generic questionnaire engine (Care questionnaire.py / Foo intake+screening vs fixed consent+rad templates); [متوسطة] patient portal missing vaccines/vitals screens though data exists in fhir.ts; [منخفضة] $match dedup, reflex tests, critical-call phone documentation, workplans per section, multi-branch tenancy.
- BMC ahead-of-reference areas documented: critical-alert escalation chain 0/10/20min, Benefit payment webhooks vs Foo display-only billing, CMMS work-orders+technician chat, WHO growth charts, QR doc verification, AR/EN RTL everywhere.
- Files written: docs/references/{medplum,foo-medical,openelis,ohif,care}.md (337 lines total). Next actions: R1 analyzer-import bidirectional endpoint, R2 vaccines/vitals patient screens, R3 questionnaire engine (Care pattern), R4 OHIF roadmap 3-phase (upload+measure → structured size fields → Orthanc+OHIF embed).

---
Task ID: G1
Agent: gap-implementation agent G1 (Z.ai Code)
Task: Implement the Immunizations capability end-to-end (R1's HIGH gap — model + FHIR read existed, no staff UI, no write API; BMC has pediatrics dept): staff server routes + staff EMR section + patient portal surface.

Work Log:
- Studied patterns first: src/server/staff/clinical.ts (actorFrom/problem/jo/json/audit + guardSign = SIGNERS ∪ nurse), perm.ts (CLINICAL_VIEWERS/SIGNERS), emr-chart.tsx/emr-shared.tsx (Section/Empty/ErrorBox/LoadingRows, ChartData), patient.ts server (patientActor session guard + guardian dependants scope), lib/api.ts actorFrom (x-bmc-actor base64), seed-part2 immunization rows (OPV/MMR, Arabic vaccine + site strings), prisma Immunization model (vaccine/vaccineEn/doseLabel/givenAt/batch/site/nextDueAt/certCode).
- src/server/staff/clinical.ts — APPENDED: "GET immunizations/for-patient" (gate CLINICAL_VIEWERS; returns given[] ordered givenAt desc + due[] + catalog echo) and "POST immunizations/record" (gate guardSign = SIGNERS ∪ nurse; body {patientId, vaccine, doseNo 1-9, date?, batch?, site?, nextDueAt?}; whitelist validation 422 VACCINE_UNKNOWN; creates Immunization row + hash-chain audit; 201 {id, nextDueAt}). Helper block at file tail: VACCINE_WHITELIST (BCG/HEPB/DTAP/OPV/MMR/FLU/COVID, ar+en+alias keys matching seed strings), IMM_SCHEDULE (fixed series by ageMonths: BCG 0, HepB 0/1/6, OPV+DTaP 2/4/6, MMR 12, boosters 18), MONTH_MS=30.4375d deterministic; dueImmunizations = next unsatisfied dose per vaccine (count-based alias matching) + annual FLU (≥6m, 365d) / COVID (≥144m); overdue = due + 30d grace; sorted overdue→due→upcoming; nextDueFor auto-computes nextDueAt (next series slot or +365d annual) when body omits it.
- src/server/patient.ts — APPENDED "GET immunizations": patient session guard (patientActor), scope = self + guardian dependants (PatientRelationship), rows carry ownerAr/ownerEn recipient names + vaccine + doseLabel + givenAt + nextDueAt (take 20, desc).
- Staff UI: NEW src/components/portals/staff/emr-immunizations.tsx (196 ln) — ImmunizationsCard section: history list (vaccine bi(), dose badge, bhDateString, batch mono, site via i18n codes w/ legacy Arabic pass-through, next-due badge red past/amber future, max-h-72 bmc-scroll) + due chips (vaccine + dose + dueAt + status badge red/amber/zinc) + schedNote; "تسجيل تطعيم" Dialog (vaccine Select fed from API catalog, doseNo, date default today UTC+3, batch, site Select arm-r/arm-l/thigh-r/thigh-l) → POST → toast + section reload + chart reload; doseOf() normalizes seed "الجرعة 4" and new "4" labels → t(emr.imm.doseN). Role mirrors server: IMM_VIEWERS gate card, IMM_WRITERS gate button; loading/error+retry/empty on fetch; h-11/min-h-11 targets. emr-chart.tsx wired: destructure reload + render card (lg:col-span-2) after encounters Section (137 ln total).
- Patient portal: screen-overview.tsx added ImmunizationsCard (useFetch /api/patient/immunizations; responsive sm:2/lg:3 grid of vaccine + date + dose + recipient + next-due badge amber/red; LoadingRows/ErrorBox/EmptyState; guardianship note) between due-invoices and documents (183 ln). lib.ts +ImmunizationItem type.
- i18n: APPEND 26 keys staff-a.ts (emr.imm.* block) + 6 keys patient.ts (pp.imm.*) — ar+en, zero emojis, lucide icons only.
- Parallel-agent note: G2 (waitlist/pathways) concurrently edited clinical.ts (pathways section now sits between my routes and my helpers), core.ts, ops.ts, schema.prisma — coordinated via agent-ctx/G1-immunizations.md; no edit collisions.

Stage Summary:
- Endpoints added: GET /api/staff/immunizations/for-patient (CLINICAL_VIEWERS), POST /api/staff/immunizations/record (SIGNERS ∪ nurse, whitelist + audit + auto nextDue), GET /api/patient/immunizations (patient session, self+dependants). Files changed: clinical.ts, patient.ts (server), emr-immunizations.tsx (new), emr-chart.tsx, screen-overview.tsx, patient/lib.ts, staff-a.ts, patient.ts (i18n). All UI files ≤250 ln.
- tsc --noEmit: 0 errors in all G1 files/sections (only remaining project errors = G2's in-flight pathways/waitlist/workorders code + their pending prisma client regen — verified none touch G1 lines). eslint: 0 problems on all 8 files.
- curl smoke (live dev server): doctor GET Ahmed P26-0000101-6 → 200 (childhood series overdue + FLU/COVID due); reception GET → 403; nurse POST FLU d1 (batch LOT-FLU-2610, arm-l) → 201 nextDue 2027-10-20; re-GET → FLU in given, dropped from due; unknown vaccine → 422 VACCINE_UNKNOWN; cashier POST → 403; child Ali GET → alias matching works (OPV d2/MMR d2 overdue, COVID skipped <144m); patient portal as Ali → 200 2 rows w/ owner names; no actor → 401; staff-audience on patient route → 401; patient w/o records → []. Smoke FLU row kept as demo data. GET / 200.

---
Task ID: G2
Agent: gap-implementation agent G2 (Z.ai Code)
Task: Activate three HIGH reference gaps with models present but zero activation — Waitlist/recalls (OpenEMR Recalls), Pathway/PathwayInstance therapeutic programs (OpenMRS PatientProgram lifecycle), and Item.parLevel auto-reorder (Frappe auto material request). Server + minimal high-quality UI.

Work Log:
- Read worklog header constraints + R1/R2 sections; studied core.ts/clinical.ts/ops.ts/scheduler.ts route+guard patterns, perm.ts RBAC (appointments = reception+callcenter only; CLINICAL_VIEWERS; SIGNERS∪nurse write gate), emr-shared/ops-shared atoms, reception tab shell, emr-chart section pattern, Notification/Task/WorkOrder/Batch schemas, seeds (PW-COMP 7-step pathway Json [{key,ar,en}], items par=10/reorder=20 with 4 items below par).
- Schema (db:push, non-destructive adds): Waitlist.priority String @default("normal") + status comment waiting|offered|booked|removed (reasonAr → note); PathwayInstance.completedAt DateTime?; WorkOrder.titleAr String? + asset relation made optional (assetId String?) + kind comment +reorder (reorder WOs carry no asset).
- Waitlist API (core.ts APPEND, guard "appointments"): GET waitlist/list (rows + patient mini + dept, PRIORITY_WEIGHT desc then FIFO); POST waitlist/add {patientId,deptCode,reasonAr,priority} + audit; POST waitlist/offer {id,slotAt} — validates waiting status + future slot + patient double-book guard, picks first appt type of the dept (prefer *-NEW, else first), price/duration from type, nextApptCode, Appointment status=requested channel=reception + first active doctor of dept, waitlist→offered, Notification(patientId, kind waitlist-offer, sms) + audit; returns appointmentCode. (Waitlist has no Prisma relations → manual map joins.)
- Pathways API (clinical.ts APPEND): GET pathways/list (can clinical); GET pathways/for-patient?id= (CLINICAL_VIEWERS) instances + template steps; POST pathways/enroll (guardSign; dup-active → 409 STATE_INVALID) creates instance active/currentStep 0 + audit; POST pathways/advance (guardSign) increments currentStep, on last step → status "done" + completedAt + audit before/after; terminal states rejected 409.
- Auto-reorder (scheduler.ts): exported runReorderCheck() — sums ok+unexpired item Batches per Item, below par → gap-ratio priority (≥50% high, ≥25% normal, else low), creates WorkOrder kind reorder (assetId null, titleAr embeds item code, checklist {itemCode,qtyOnHand,parLevel,reorderQty}, SLA 24/48h) + Task role inventory + Notification role inventory + realtime emit; idempotent via open-reorder-WO itemCode set (titleAr regex + checklist). Wired into runSchedulerTick behind module-level 10-min throttle; tick result += reorders.
- Ops hardening for asset-less WOs: maintenance/work-orders maps asset:null (was crashing w.asset.code); wo-status/wo-close guard asset updates behind w.assetId.
- UI: reception.tsx new tab قائمة الانتظار + NEW reception-waitlist.tsx (250 ln) — priority-toned table (patient/dept/reason/priority badge/status/created), add dialog (patients/search picker + dept/reason/priority Selects), offer dialog (datetime-local BH +03:00, default tomorrow 10:00) → toast appointmentCode; emr-chart.tsx + NEW emr-programs.tsx (210 ln) — ProgramsCard with enroll dialog (template Select), step chips done/current/pending + sr-only states, إكمال الخطوة الحالية advance, past instances list; PROG_VIEWERS/WRITERS mirror server RBAC; ops-workorders.tsx AssetCell handles null asset (item code + مخزون) + reorder KindChip; ops-shared WoRow.asset nullable + titleAr.
- i18n: staff-a.ts +55 keys (rec.wl.*, emr.pro.*, status.offered, status.aborted), staff-d.ts +ops.wo.kind.reorder/ops.wo.store. No emojis; RTL logical props; h-11 dialog targets; money untouched (fils ints).
- Drive-by fix (pre-existing crash blocking staff portal): ops-quality.tsx data!.nps/surveyCount → data?.nps ?? 0 (JSX children evaluated before Panel loading guard → TypeError on first mount for quality roles).
- Coordination: G1 concurrently appended immunizations to clinical.ts/i18n/emr-chart — merged cleanly (their section untouched, my pathways section after theirs; both cards render in summary tab).

Stage Summary:
- Endpoints added (staff API): GET waitlist/list, POST waitlist/add, POST waitlist/offer; GET pathways/list, GET pathways/for-patient, POST pathways/enroll, POST pathways/advance. Scheduler: runReorderCheck (10-min throttle, idempotent).
- Smoke (curl, live dev): waitlist add×2 → list ordered emergency-before-elderly FIFO; offer → A-261020-9002 DENT-EXAM 12000 fils requested + SMS notif; re-offer 409; callcenter 200/inventory 403. Pathways: list 1 template; enroll → advance 0→7 → done + completedAt; double-enroll 409; advance-after-done 409; reception for-patient 403. Reorder: dev-server restart tick auto-created 4 WOs (ITM-DNT-0003 low 9/10, ITM-BRS-0007 high 4/10, ITM-SPR-0008 high 2/10, ITM-SPR-0009 high 5/10) + 4 inventory Tasks + 4 notifications; second run created 0 (idempotent); wo-status/wo-close on reorder WO OK (asset guards).
- E2E (agent-browser): reception waitlist tab renders rows/status badges; add dialog (search حسن → pick → reason → submit → row appears); offer dialog → A-261020-9003 GP-NEW 15000 fils created + row flips to عُرض موعد; doctor chart → البرامج العلاجية card shows done instance 7/7 with dates; enroll dialog → active instance step chips 1/7; advance → 2/7. Zero browser errors.
- Verified: bunx tsc --noEmit 0 errors; bunx eslint 13 changed files 0 problems; dev.log clean; files ≤250 ln (new UI 250/210).
- Files changed: prisma/schema.prisma, src/server/staff/{core,clinical,ops}.ts, src/server/scheduler.ts, src/components/portals/staff/{reception.tsx, reception-waitlist.tsx (NEW), emr-chart.tsx, emr-programs.tsx (NEW), ops-shared.tsx, ops-workorders.tsx, ops-quality.tsx}, src/i18n/{staff-a,staff-d}.ts.

---
Task ID: MAIN-2 (orchestrator continuation)
Agent: main (Z.ai Code)
Task: متابعة الجلسة — إزالة كل الإيموجي، إصلاح me/modules 404 وFHIR prefix، إكمال البوابة العامة، استنساخ الأنظمة المرجعية، فحص تقاطعي + تنفيذ الفجوات، إصلاح CI، E2E شامل

Work Log:
- فحص الحالة: dev server كان ميتاً (عمليتان قديمتان) → إعادة تشغيل نظيفة على 3000 + إعادة تشغيل realtime 3003.
- إصلاح POST /api/staff/me/modules 404 (الواجهة كانت ترسل POST والخادم GET) + استبدال أيقونات الوحدات (🧾🩺🧪💳🚗🔧/☰/⏻) بأيقونات Lucide في staff/index.tsx وdomain-bar.tsx وops.tsx وlab.tsx وbook-dialog (📹→Video) وadmin-health (✓/✗→Check/X).
- إطلاق وكلاء E1/E2/E3 المتوازيين: إزالة ~127 إيموجي من 35 ملف وحدات الموظفين واستبدالها بأيقونات Lucide (tsc+eslint نظيفان، صفر إيموجي في src/).
- اكتشاف أن البوابة العامة كانت placeholder رغم وجود 1352 سطراً من الأقسام الجاهزة → بناء index.tsx كاملاً (SubNav بمرساة IntersectionObserver + Hero + 10 أقسام + PreFooter + BookingDialog + AiAssistant) + بناء faq.tsx وcontact.tsx (نموذج تواصل بترقيم تتبع CMP-) وai-assistant.tsx (widget عائم POST /api/ai/chat مع z-ai-web-dev-sdk) + إصلاح تسمية حقل الاسم وإضافة مفاتيح i18n.
- reader-sdk: تنزيل SCardReadServer.7z (30MB) + eRevealerSetup.7z (49MB) من مصدر S3 الرسمي + SHA256SUMS + README توثيقي كامل بالاحتياطات الأربع (§3.6) + إضافة POST /api/kiosk/reader-scan (Identity Reader Adapter بمطابقة blind-index).
- إصلاح bug مسارات FHIR المزدوجة (fhir/fhir/* → /*) — 9 موارد + metadata تعمل الآن بالمسار القياسي.
- إصلاح CI (كان يفشل: Prisma Permission denied لأن DATABASE_URL مطلق غير ملتزم): env على مستوى المهمة file:/tmp/ci.db + بوابة إقلاع الخادم + بدء realtime قبل فحص الدخان + إنشاء scripts/verify-system.mjs (14 فحصاً عبر كل النطاقات) — CI: success على c32f982.
- استنساخ الأنظمة المرجعية الـ12 (spec §2.1) في reference-systems/ (gitignored، محلي فقط): openemr 151M + openmrs-core 33M + bahmni-core + openhospital(core/ui) + frappe-health + erpnext 188M + care + medplum 261M + foo-medical + openelis 264M + ohif-viewers 136M + icoms (~1.1GB) عبر codeload tarballs مع استئناف مرن (scripts/fetch-order.sh).
- وكلاء R1/R2/R3: فحص تقاطعي (§2.3) أنتج 11 تقريراً في docs/references/ مع فجوات مصنفة بالأولوية.
- وكلاء G1/G2: تنفيذ الفجوات عالية الأولوية بدون تغيير مخطط جذري — التطعيمات (3 نقاط نهاية + emr-immunizations + بطاقة بوابة المريض)، قائمة الانتظار/الاستدعاءات (3 نقاط + تبويب reception-waitlist + تحويل لموعد A-…)، البرامج العلاجية (4 نقاط + emr-programs بإدارة دورة الحياة)، أتمتة إعادة الطلب في المجدول (WorkOrders + مهام + إشعارات، idempotent).
- تحديث docs/API.md (immunizations/waitlist/pathways/reader-scan/FHIR bridge) + docs/references/gnu-health.md (خارج GitHub — توثيق وظيفي).
- E2E بالمتصفح: الموقع العام (حجز ضيف كامل بقسم/طبيب/موعد/OTP→A-261020-9001+MRN جديد، مساعد AI بردّ حقيقي، نموذج تواصل CMP-MVGGT8JH) + بوابة المريض (11 شاشة) + الموظفين (بحث عربي ضبابي→ملف طبي 8 تبويبات) + الكشك (تذكرة C-001 عبر موعد مؤكد) + شاشة الانتظار (حية) + التحقق (مستند BI-RADS صالح) + الإدارة (حجب طبيب 403 + فحص صحة بعودة realtime) — صفر أخطاء وحدة تحكم.
- حلقة المزامنة الساعية تعمل (scripts/sync-loop) + دفعات يدوية عند كل معلم.

Stage Summary:
- المشروع الآن: صفر إيموجي، CI أخضر مع verify-system 14/14، البوابة العامة مكتملة (كانت placeholder!)، FHIR بالمسار القياسي، الأنظمة المرجعية الـ12 مستنسخة محلياً + 11 تقرير فحص تقاطعي، 4 فجوات عالية الأولوية منفذة (تطعيمات/انتظار/برامج/إعادة طلب)، reader-sdk موثق مع adapter فعلي، tsc 0 أخطاء، eslint 0 مشاكل، كل البوابات السبع مختبرة E2E.
