# BMC API Contract (internal reference for UI agents)

Base URL: relative paths only (browser). Actor session: sent automatically by
`src/lib/api-client.ts` via `x-bmc-actor` header from the store (staff or patient session).

Use: `apiGet<T>(path)` / `apiPost<T>(path, body)` from `@/lib/api-client`.
Errors: RFC7807 bilingual — `err.problem.detailAr/detailEn`, `err.problem.code`.

## Sessions (no auth)
- `GET /api/staff/login-options` → `[{ id, role, nameAr, nameEn, deptCode, deptAr }]`
- `GET /api/patient/login-options` → `[{ id, mrn, nameAr, nameEn, phone }]`

## Public — website.bh
- `GET /api/public/catalog` → `{ departments:[{code,nameAr,nameEn,descAr,descEn,color,icon,prepAr,prepEn}], doctors:[{id,nameAr,nameEn,gender,deptAr,deptEn,deptCode,specialtyAr,specialtyEn,credentialsAr,credentialsEn,languages,licenseNo,bioAr,bioEn}], services:[{code,nameAr,nameEn,priceFils,durationMin,deptAr,deptCode,prepAr,prepEn,isVideo,fasting}], packages:[{code,nameAr,nameEn,priceFils,descAr,descEn,items}], articles, faqs, jobs, insurers }`
- `GET /api/public/article?slug=` → single article
- `GET /api/public/slots?dept=GP&doctor=&day=0` → `{ date, slots:[{doctorId,doctorAr,doctorEn,at,priceFils}] }`
- `POST /api/public/booking/request` `{nameAr,phone,slot,doctorId?,deptCode?}` → `{id,code,otpDemo,noteAr}` (201)
- `POST /api/public/booking/verify` `{bookingId,otp}` → `{appointment:{code,start},patient:{mrn,nameAr},noteAr}` (201)
- `POST /api/public/contact` `{nameAr,phone,message,category?}` → `{tracking,slaAr}` (201)
- `POST /api/ai/chat` `{message,lang}` → `{answer}` (backend LLM, admin-info only)

## Patient — patient.website.bh (requires patient session)
- `GET /api/patient/overview` → `{patient:{id,mrn,nameAr,nameEn,assurance,idMasked,flags,dob,gender,phone}, insurance, upcoming:[{id,code,start,status,deptAr,typeAr,doctorAr,barcode,prepAr,prepEn,priceFils,paymentStatus}], unreadNotifications, dueInvoices, documents}`
- `GET /api/patient/appointments` → history list (same shape + barcode)
- `POST /api/patient/appointments/book` `{start,typeCode,deptCode?,doctorId?}` → `{id,code,barcode}` (409 SLOT_TAKEN/PATIENT_DOUBLE_BOOKED)
- `POST /api/patient/appointments/cancel` `{appointmentId}` (409 CANCEL_WINDOW if <4h)
- `GET /api/patient/results` → `{results:[{testAr,testEn,value,unit,flag,refLow,refHigh,resultedAt,comment}], imaging:[{reportAr,reportEn,grade}]}`
- `GET /api/patient/prescriptions` → `[{code,status,items:[{drugAr,doseAr,frequency,instrAr}],dispensedCount}]`
- `POST /api/patient/prescriptions/refill` `{prescriptionId}` (201)
- `GET /api/patient/invoices` → `{invoices:[{code,status,totalFils,patientFils,insurerFils,vatFils,neutralDesc,lines}], payments}`
- `GET /api/patient/consents` → `{signed:[...], templates:[{key,titleAr,titleEn,bodyAr,bodyEn,minReadSec}]}`
- `POST /api/patient/consents/sign` `{templateKey,otp,readSeconds}` — OTP demo `1234`; enforces minReadSec (422 READ_TOO_FAST)
- `POST /api/patient/consents/withdraw` `{consentId}`
- `GET /api/patient/access-log` → `[{at,action,by,role,reason}]` (view-chart/break-glass/reader-read)
- `GET /api/patient/family` → `{dependants:[{id,mrn,nameAr,relation,dob}]}`
- `GET /api/patient/growth` → `[{child,records:[{metric,value,ageMonths,z,percentile,flag}]}]`
- `POST /api/patient/home-request` `{tests,slot,fasting,prefGender,address}` → `{id,code,feeFils}` (fees by governorate zone)
- `GET /api/patient/home-tracking` → `[{code,status,slot,feeFils,tests,visit}]`
- `GET /api/patient/notifications` → list

## Staff — staff.website.bh (requires staff session; role-gated per module)
Reception/queue:
- `GET /api/staff/reader/status` · `POST /api/staff/reader/read` `{cardIndex?}` → `{existing:{mrn,nameAr}|null, record:{idNumber(CPR),fullNameAr,fullNameEn,dob,gender,nationality,address,phone,readAt}}` (simulated smart card)
- `GET /api/staff/patients/search?query=` → `{exact:[{id,mrn,nameAr,dob,phone,assurance,idMasked}], similar:[{...score}]}` (Arabic-normalized + fuzzy)
- `POST /api/staff/patients/register` `{firstAr,familyAr,dob,gender,phone(+973),cpr?/gccCountry+gccNumber?/passportCountry+passportNumber?,payerId?,motherAr?...}` → 201 `{id,mrn,nameAr,duplicateWarnings}` · 409 ID_DUPLICATE · 422 PHONE_INVALID_BH/ID_INVALID_CPR
- `GET /api/staff/patients/chart/{id}` → `{banner:{mrn,nameAr,age,gender,assurance,idMasked,flags,insurance,restricted}, clinical?{problems,allergies,meds,imms,growth,encounters,vitals}, adminOnly?}`
- `GET /api/staff/board?dept=` → today's appointments `[{code,start,status,channel,patient{...},doctor,dept,type,paymentStatus}]`
- `POST /api/staff/appointments/book` `{patientId,start,typeCode,employeeId?}` → 201 (409 conflicts)
- `POST /api/staff/checkin` `{appointmentId|barcode|cpr, priority?}` → 201 `{ticket:{code},encounter}` (409 TOO_EARLY/TOO_LATE)
- `GET /api/staff/queue/list?point=C` → weighted queue order
- `POST /api/staff/queue/call-next` `{point,room}` → `{called:{code,room,patient}}` + realtime broadcast
- `POST /api/staff/queue/serve` `{ticketId,action:serve|done|no-show}`
Clinical:
- `POST /api/staff/encounters/open` `{patientId,departmentId?}` → 201
- `POST /api/staff/encounters/soap` `{encounterId,chief?,hpi?,exam?,assessment?,plan?,instructionsAr?,soap?,addendum?}`
- `POST /api/staff/encounters/sign` `{encounterId}` (409 if signed)
- `POST /api/staff/encounters/finish-visit` `{encounterId,followUpDays?}` → `{checks}`
- `POST /api/staff/vitals` `{patientId,...}` → 201 `{bmi}`
- `POST /api/staff/problems` `{patientId,icd10,nameAr,nameEn}` · `POST /api/staff/allergies` `{patientId,substance,reaction?}`
- `POST /api/staff/orders` `{patientId,kind,priority,reason,items:[{testCode|imagingCode}]}` → 201 `{code,totalFils,warnings}` (dup 24h warnings)
- `GET /api/staff/orders/list?status=`
- `POST /api/staff/referrals` `{patientId,toDept,urgency,reason}` → 201 `{code,responseDueAt}` · `POST /api/staff/referrals/respond` `{referralId,status,note}`
- `GET /api/staff/mdt/list` · `POST /api/staff/mdt/decision` `{caseId,decision,tasks}`
- `GET /api/staff/consents/templates` → 19 templates · `POST /api/staff/consents/capture` `{patientId,templateKey,method,signedBy,readSeconds,otp?,witnessId?}` (422 READ_TOO_FAST)
- `GET /api/staff/consents/for-patient?patientId=` → `{consents, hardStopsPending:["consent.surgery",...]}`
- `GET /api/staff/inbox` → `{tasks, notifications, threads}` · `POST /api/staff/tasks/complete` · `GET /api/staff/messages/thread?id=` · `POST /api/staff/messages/send`
Lab/imaging/radiology:
- `GET /api/staff/phleb/worklist` · `POST /api/staff/phleb/draw` `{orderId,tubes?,difficulty?,incident?}` → 201 `{code,barcode}`
- `GET /api/staff/lab/worklist` → `{specimens, pendingResults, criticalAlerts:[{id,status,test,value,notifiedAt,patient,log}]}`
- `POST /api/staff/lab/receive` `{specimenId,reject?,tempC?}` (double-scan custody)
- `POST /api/staff/lab/result` `{orderItemId,value,comment?}` → 201 `{flag,autoVerified,needsHuman,reason,deltaPct}` (autoverification §17.9; CRIT → alert + doctor notification)
- `POST /api/staff/lab/verify` `{resultId,release?}` · `POST /api/staff/lab/ack-critical` `{alertId}`
- `POST /api/staff/lab/analyzer-push` `{orderItemId,value}` → HL7 sim
- `GET /api/staff/lab/qc` · `POST /api/staff/lab/qc` `{testCode,level,target,observed}` → `{status,rule}`
- `GET /api/staff/radiology/worklist` · `POST /api/staff/radiology/capture` `{patientId,typeCode,pregnancyChecked:true}` (412 CONSENT_REQUIRED if not) · `POST /api/staff/radiology/report` `{studyId,reportAr,reportEn,findingsAr,grade,template,sign}`
Pharmacy:
- `GET /api/staff/pharmacy/queue` → `[{code,status,patient,items:[{drug,doseAr}],safety}]`
- `POST /api/staff/prescriptions` `{patientId,items:[{drugCode,doseMg,doseAr,frequency,durationDays,qty,instrAr}],overrideReason?}` → 201 `{code,blocked,errors,warnings,doseHelpers}` (§17.7 — blocked unless overrideReason)
- `POST /api/staff/pharmacy/dispense` `{prescriptionItemId,counseled,paymentStatus}` → 201 `{batch:{lotNo,expiry}}` (FEFO)
- `POST /api/staff/pharmacy/recall` `{lotNo}` → `{notified}` (§17.15)
- `GET /api/staff/pharmacy/stock` → `{drugs, batches}` (FEFO ordered)
Billing/insurance/home:
- `POST /api/staff/invoices/create` `{patientId,lines:[{kind,nameAr,nameEn,unitFils,qty,isDrug?}],discountFils?,isQuotation?}` → 201 `{code,subtotalFils,vatFils,totalFils,patientFils,insurerFils,capped,lines}` (§17.10; psych→neutralDesc)
- `POST /api/staff/invoices/accept-quotation` `{invoiceId,acceptedBy}`
- `POST /api/staff/payments/pay` `{invoiceId,method:cash|card|benefit,amountFils?,idempotencyKey?}` → 201 `{code,receiptQr}` (409 IDEMPOTENT_DUP)
- `POST /api/staff/shifts/open` `{openingFils}` · `POST /api/staff/shifts/close` `{shiftId,countedFils}` → `{expectedFils,difference,methods}`
- `GET /api/staff/preauths/list` · `POST /api/staff/preauths/request` `{patientId,payerId,serviceRef,amountFils}` · `POST /api/staff/preauths/approve` `{preauthId,approvedRef?,reject?}`
- `GET /api/staff/claims/list` · `POST /api/staff/claims/submit` `{invoiceIds,patientId,payerId,resubmitOf?,correctedCoding?}` · `POST /api/staff/claims/remit` `{claimId,approve?,partial?,rejectReason?,approvedFils?}`
- `GET /api/staff/home/requests` → `{zones, requests}` · `POST /api/staff/home/confirm` `{requestId,feeFils?}`
- `POST /api/staff/home/plan-routes` `{date?}` → `{routes:[{zone,collector,order:[{seq,addr,fasting,etaMin}],totalKm,warnings}], algorithm:"nearest-neighbor + 2-opt + fasting-first"}`
- `POST /api/staff/home/visit-status` `{visitId,status:arrived|drawn|to-lab,otpShown?,paymentMethod?,amountFils?,sampleTempC?,incident?}`
Ops (maintenance/inventory/HR/quality/reports):
- `GET /api/staff/maintenance/assets?code=` (barcode open) → `{plans, assets}`
- `POST /api/staff/maintenance/report-fault` `{assetCode,description,impact:full|partial|none,category,photos?}` → 201 `{code,workOrder:{code,slaDueAt}}` (auto WO + tech notification)
- `GET /api/staff/maintenance/work-orders` → `[{...,messages:[{senderId,body,kind,at}],parts,overSla}]`
- `POST /api/staff/maintenance/wo-message` `{workOrderId,body,kind:text|part|image}` (201 — technician chat)
- `POST /api/staff/maintenance/wo-status` `{workOrderId,status,note?}` · `POST /api/staff/maintenance/wo-close` `{workOrderId,rootCauseAr,actionAr,downtimeMin,signatureBy?}` → `{mttrMin}`
- `GET /api/staff/maintenance/metrics` → `{mttrMin,mtbfDays,assetsByStatus,topDowntime}`
- `GET /api/staff/inventory/items` → `{items,batches,moves}`
- `GET /api/staff/hr/employees` → `{employees:[{...licenseDaysLeft}], facilityLicenses}`
- `GET /api/staff/quality/overview` → `{incidents,complaints(with overSla),capas,nps}`
- `POST /api/staff/quality/incident` `{type,severity,description,anonymous?}`
- `GET /api/staff/reports/overview` → `{kpis, dailyRevenue:[{date,fils}]}`
Admin:
- `GET /api/staff/audit/search?action=&patientId=` → audit events (auditor/dpo/sysadmin)
- `GET /api/staff/audit/chain` → `{ok,checked,brokenAt}` (hash-chain verification)
- `GET /api/staff/settings/list` → `{settings,flags,sequences,licenses}` (sysadmin)
- `GET /api/staff/me/modules` → allowed modules for role

## Devices
- `POST /api/kiosk/check-in` `{barcode:"BMC-APPT-xxxx"}` or `{cpr:"9 digits"}` or `{mrn}` → `{ticket:{code},room,mrn,idMasked}` (409 TOO_EARLY)
- `GET /api/queue/display` → `{display:[{pointAr,pointEn,code,room,waitingCount}], generatedAt}`
- `POST /api/verify/check` `{code:"BMC-XXXXXXXXXXXXXXXXXXXXXX"}` → `{valid,kind,titleAr,issuedAt,doctorNameAr,doctorLicense}` (no patient data)
- `GET /api/system/health` → `{ok,db,realtime,counts,now}`
- Webhook: `POST /api/webhooks/payment/benefit` (x-signature HMAC) — no card data stored

## Shared helpers
- Money: `MoneyText` component / `BHD3(fils)` from `@/lib/money` — fils are integers (1.500 BHD = 1500).
- Barcodes: `Code128` (operational) & `QrCode` (documents only) from `@/components/shared/barcode`.
- `StatusBadge`, `FlagBadges` from `@/components/shared/badges`.
- `PatientBanner` from `@/components/shared/patient-banner`.
- Realtime: `useRealtime(event, handler)` from `@/lib/realtime-client` (socket.io via `/?XTransformPort=3003`).
- Times are UTC ISO — display in Bahrain time (UTC+3): helper `bhTimeString/bhDateString` from `@/lib/bahrain` (client-safe).
