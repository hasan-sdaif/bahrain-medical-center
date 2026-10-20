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
