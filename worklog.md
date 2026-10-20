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
