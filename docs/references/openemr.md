# OpenEMR — دراسة مرجعية ومطابقة مع BMC

> Task ID: R1 · النسخة المدروسة: استنساخ محلي `reference-systems/openemr` (التزام 2026-10-20). هذه وثيقة بحثية — لا تغييرات على كود التطبيق.

## نظرة عامة

OpenEMR هو نظام سجلات صحية إلكترونية (EHR) مفتوح المصدر مكتوب بـ PHP، من أقدم الأنظمة وأكثرها اكتمالاً (أول إصدار 1999)، ومعتمد رسمياً من ONC الأمريكية (Certified EHR) — لذلك يحتوي ميزات امتثال تنظيمي أمريكية (CQM/AMC/RWT) لا تنطبق مباشرة على مركز بحريني. يتميز عن BMC بـ: (1) محرك نماذج سريرية قابل للتخصيص (Layouts/LBF) بدل بنية SOAP الثابتة، (2) تبادل بيانات قياسي واسع (FHIR R4 US Core + OAuth2 + SMART + CCDA + X12 EDI)، (3) سجل مواعيد مرن متعدد المزودين، (4) بوابات مريض مكتملة. BMC يتفوق عليه في: قائمة الانتظار المرجحة §17.5، المختبر بتحقق آلي وLevey-Jennings وتنبيهات حرجة متصاعدة، الفوترة بفلس BHD وVAT، سلسلة تدقيق هاش (hash-chain)، CMMS بأوامر عمل ودردشة، السحب المنزلي بخوارزمية توجيه، الواجهة ثنائية اللغة RTL أولاً.

أدلة الجرد الأساسية: `interface/main/tabs/menu/menus/standard.json` (قائمة 2338 سطر — كل وظائف النظام)، `interface/modules/zend_modules/module/` (الوحدات الرسمية)، `interface/modules/custom_modules/` (الوحدات الاختيارية)، `interface/forms/` (نماذج اللقاءات)، `interface/reports/` (49 تقريراً)، `portal/` (بوابة المريض)، `apis/routes/` (واجهات التبادل).

## جرد القدرات والمطابقة

| القدرة | الموقع في الأصل | مقابلها في BMC | الحالة |
|---|---|---|---|
| التقويم/المواعيد (حسب المزود، متكررة، تصنيفات) | `interface/main/calendar/` (add_edit_event.php, find_appt_popup.php) + `library/appointments.inc.php` | `staff/core.ts` appointments/slots + `public.ts` slots + بوابة المريض book | مغطى |
| لوحة التدفق Flow Board (تتبع حالة المريض عبر العيادة) | `interface/patient_tracker/patient_tracker.php` + تقرير patient_flow_board | `reception-queue.tsx` + `devices.ts` display + وزن الطابور §17.5 | مغطى |
| سجل المرضى + دمج المكررات | `interface/patient_file/merge_patients.php`, `manage_dup_patients.php`, `library/dupscore.inc.php` | `core.ts` patients/register + merge + `lib/arabic.ts` (نقاط تطبيع/تطابق ضبابي) | مغطى |
| المستدعيات Recalls (عودة المريض بعد مدة) | `interface/main/messages/messages.php?go=Recalls` + `print_postcards.php` | نموذج `Waitlist` في `prisma/schema.prisma` (مزروع seed فقط) — **لا يوجد API ولا واجهة** | **فجوة** |
| الرسائل/الملاحظات بين الطاقم | `interface/main/messages/`, `pnotes_*` | `clinical.ts` inbox + messages/thread + `emr-inbox.tsx` + Notification | مغطى |
| اللقاءات بنماذج سريرية متنوعة (35 نموذجاً: SOAP، فحص بدني، ROS، phq9/gad7، خطة علاج، SDOH، عين، ألم…) | `interface/forms/` (soap, vitals, phq9, gad7, physical_exam, ros, care_plan, sdoh, eye_mag, painmap…) | لقاء واحد ببنية SOAP ثابتة في `emr-encounter.tsx` (chief/hpi/exam/assessment/plan) | جزئي |
| **محرك النماذج القابل للتخصيص (LBF/Layouts)** | `interface/super/edit_layout.php`, `edit_list.php` + `forms/LBF` | لا يوجد محرك نماذج ديناميكي — بنية ثابتة | **فجوة** |
| أدوات قياس نفسية مرقّمة (PHQ-9/GAD-7) كنماذج سريرية | `interface/forms/phq9/`, `gad7/` | لا يوجد (قسم الطب النفسي موجود في BMC!) | **فجوة** |
| ورقة الرسوم Fee Sheet + الترميز | `interface/forms/fee_sheet/` + `library/FeeSheet*.php` + `find_code_dynamic.php` (ICD/CPT) | `billing.ts` invoices/create (ServiceItem + ICD في claims) | مغطى |
| فوترة EDI: X12 837، استعلام أهلية 270/271، ERA إلكتروني | `interface/billing/` (edi_270, edi_271, era_payments, sl_eob_process, get_claim_file, ub04_*) | مطالبات داخلية محاكاة (claims/submit + remit عبر PAYERS) — لا X12 ولا ERA ولا UB04 | جزئي |
| الدفعات الدفعية والترحيل الجماعي | `interface/billing/new_payment.php`, `era_payments.php` | `billing/payments/pay` (idempotent) + shifts | مغطى |
| الوصفات الإلكترونية eRx خارجية (شبكة، تجديد، EPCS مواد خاضعة) | `interface/eRx*.php` + `custom_modules/oe-module-weno` + `logview/erx_logview.php` | وصفات داخلية بفحوصات أمان §17.7 + صرف FEFO — لا شبكة eRx خارجية | جزئي |
| مخزون الأدوية (دفعات، إتلاف، جرد) | `interface/drugs/` (add_edit_lot, destroy_lot, drug_inventory, dispense_drug) + تقارير inventory_* | `pharmacy.ts` + `ops.ts` inventory (Batch/StockMove/حالات stone/إتلاف waste) | مغطى |
| أوامر المختبر الشامل: كومبنديوم مورّدين، HL7 صادر/وارد، مطابقة مريض | `interface/orders/` (load_compendium, gen_hl7_order, receive_hl7_results, patient_match_dialog, procedure_provider_*) | `lab.ts` (worklist/receive/result/verify/analyzer-push بمحاكاة HL7 ORU) — لا توجيه لموردين خارجيين | جزئي |
| التطعيمات (سجل + تقرير سجل تطعيمات) | `zend_modules/module/Immunization/` + `reports/immunization_registry.php` + `summary/immunizations.php`, `shot_record.php` | نموذج `Immunization` (قراءة فقط: FHIR + chart) — **لا توجد واجهة إدخال للموظفين ولا تقرير** | **فجوة** |
| قواعد قرار سريري + تذكيرات سريرية قابلة للإعداد | `library/clinical_rules.php` (3532 سطر) + `interface/super/rules/` + `summary/clinical_reminders_fragment.php` | `lib/algorithms.ts` (فحوصات Rx، دلتا، تصعيد حرج) — قواعد مبرمجة ثابتة لا تُدار من الواجهة | جزئي |
| التدخلات الجماعية/جلسات علاج جماعي | `interface/therapy_groups/` (حضور الجلسات + لقاءات جماعية) | لا يوجد (رغم قسم الطب النفسي) | **فجوة** |
| بوابة المريض (مواعيد، رسائل، نتائج، أدوية، مستندات، دفع) | `portal/` (home, add_edit_event_user, messaging/, get_lab_results, portal_payment.stripe/authorizenet, account/) | `portals/patient/` 11 شاشة (مواعيد+حجز، نتائج، وصفات+تجديد، فواتير+دفع، مستندات+QR، رسائل) | مغطى |
| طلبات تعديل السجل من المريض (Amendments) | `patient_file/summary/add_edit_amendments.php`, `list_amendments.php` | شاشة الخصوصية تعرض حقوق PDPL دون سير عمل تعديل رسمي | جزئي |
| استبيانات المريض المُبلَّغ ذاتياً (PRO) | `portal/questionnaire_render.php` + `forms/questionnaire_assessments` | SurveyResponse (NPS فقط) + محادثة AI إدارية | جزئي |
| CCDA/CCR تبادل سجل المريض | `ccr/` (createCCR, transmitCCD) + `zend_modules/module/Carecoordination` | Referral + MDT + FHIR DocumentReference — لا تصدير CCDA | جزئي |
| واجهات تبادل: FHIR R4 US Core، REST قياسي، OAuth2، SMART | `apis/routes/_rest_routes_fhir_r4_us_core_3_1_0.inc.php`, `oauth2/authorize.php`, `interface/smart/` (register-app, ehr-launch) | `src/server/fhir.ts` — قراءة فقط، 9 موارد، بلا OAuth2/SMART | جزئي |
| المراسلة الموثوقة بين مقدمي الخدمة | `interface/main/messages/trusted-messages.php` | referrals/respond + MDT (داخلي) | جزئي |
| الرصد الوبائي (Surveillance) | `zend_modules/module/Syndromicsurveillance` + `reports/` | لا يوجد (بلاغات حوادث داخلية فقط) | **فجوة** |
| القياسات التنظيمية CQM/AMC/RWT | `reports/cqm.php`, `amc_full_report.php`, `rwt_2026_report.php`, `super/rules` | لا يوجد (لا ينطبق تنظيمياً على البحرين؛ بديلها مؤشرات الجودة/NPS) | فجوة (منخفضة) |
| التسهيلات المتعددة Facilities + مناطق خدمة | قائمة Admin>Clinic>Facilities في `standard.json` + `multi_facility` في settings | نموذج `Branch` في schema (مزروع) — غير مستخدم فعلياً في الواجهات | جزئي |
| ACL صلاحيات دقيقة (phpGACL) + قوائم حسب الدور | `gacl/` + `acl_req` في كل عنصر قائمة + `interface/usergroup/` | `perm.ts` مصفوفة RBAC §5.3 + me/modules + بوابات أدوار في كل شاشة | مغطى |
| سجل التدقيق + كشف التلاعب | `library/logview`, `reports/audit_log_tamper_report.php` | `AuditEvent` بسلسلة هاش + `admin-audit.tsx` + audit/chain | مغطى (أقوى) |
| تواصل دفعي (بريد/SMS جماعي، قوائم هاتف) | `interface/batchcom/` (batchEmail, smsnotification) + `library/MedEx/` + `maviq_phone_api.php` | Scheduler تذكيرات فردية (24س/2س) — لا حملات جماعية | جزئي |
| تليفزيون طبي/مكالمات فيديو | `custom_modules/oe-module-comlink-telehealth` | لا يوجد | فجوة (منخفضة) |
| فاكس/SMS وحدة | `custom_modules/oe-module-faxsms` | لا يوجد (تُحاكى القناة في Notification) | جزئي |
| تصدير بيانات المريض الإلكتروني EHI | `custom_modules/oe-module-ehi-exporter` | تصدير محكوم معطّل في `ops-reports.tsx` (بانتظار تفعيل الإعدادات) | جزئي |
| الموافقات المسبقة Prior Auth | `custom_modules/oe-module-prior-authorizations` + `forms/prior_auth` | `billing.ts` preauths (طلب/اعتماد/رفض) | مغطى |
| قوالب المستندات + فاكس قوالب | `super/manage_document_templates.php` | لا يوجد محرر قوالب (19 قالب موافقة ثابتة + مستندات بإصدار) | جزئي |
| تقارير (49 تقريراً: مالية، يومية، تحصيلات، خدمات، مخزون، إحالات…) | `interface/reports/` (pat_ledger, collections, daily_summary, services_by_category, referrals_report…) | `ops-reports.tsx` 10 مؤشرات + رسم إيراد يومي فقط | جزئي |
| العطلات الرسمية في التقويم | `interface/main/holidays/` (استيراد) | إعدادات الصلاة/رمضان في Setting (بدون تقويم أعياد) | جزئي |
| إشعارات موقوتة للمستخدم (dated reminders) | `interface/main/dated_reminders/` | Task (استحقاق dueAt) + Notification | مغطى |
| توليد تقارير مخصصة | `reports/report.script.php`, `custom_report_range.php`, `patient_list_creation.php` | لا يوجد منشئ تقارير مخصص | جزئي |
| كلمة مرور مرة واحدة TOTP | `library/classes/Totp.class.php` | `OtpCode` (أكواد تحقق) — لا 2FA لطاقم العمل | جزئي |
| تسميات طباعة (رسم/عنوان/باركود) | `patient_file/*_label.php` + `PDF_Label.php` | Code128 للمرضى/العينات/التذاكر + طباعة ملصق سحب | مغطى |

## الفجوات ذات الأولوية

1. **[عالية] سجل التطعيمات بلا واجهة إدخال**: نموذج `Immunization` موجود ومُنظَّر عبر FHIR (`src/server/fhir.ts` سطر 165) لكن لا يوجد مسار إدخال للممرضة/الطبيب ولا تقرير سجل تطعيمات، بينما لدى BMC قسم أطفال وOpenEMR يوفر وحدة كاملة (`zend_modules/module/Immunization/`). **الحد الأدنى**: شاشة "تطعيم" ضمن تبويبات EMR → `POST clinical/immunizations` (vaccine + dose + lot + site + date) + إظهار السجل في شاشة chart وتقرير أطفال في ops-reports.
2. **[عالية] المستدعيات/قائمة الانتظار المخططة ميتة**: نموذج `Waitlist` مزروع فقط بلا endpoints ولا واجهة؛ OpenEMR يجعل Recalls بنداً علوياً في القائمة الرئيسية. BMC يملك تذكيرات المواعيد لكن لا "عيدي المريض بعد 6 أشهر". **الحد الأدنى**: `GET/POST staff/waitlist` + جدول في شاشة الاستقبال + مهمة Scheduler يومية تُنشئ إشعار استدعاء عند الاستحقاق.
3. **[متوسطة] غياب أدوات الفرز النفسي المرقّمة (PHQ-9/GAD-7)**: OpenEMR يقدمها نماذج سريرية أصلية (`interface/forms/phq9/`, `gad7/`)، وBMC لديه قسم طب نفسي وطفل معزول نفسياً في البذور. **الحد الأدنى**: نموذج تسجيل نتيجة مقياس (score + severity) ضمن لقاء الطب النفسي في `emr-encounter.tsx` مع تخزين في Vitals أو جدول نتيجة استبيان جديد.
4. **[متوسطة] تصدير مطالبات بمعيار X12 837/ERA**: فوترة BMC محاكاة داخلية؛ الواقع البحريني يتطلب تبادلاً مع شركات التأمين (BHN/GEMS). OpenEMR يوفر خط أنابيب EDI كاملاً (`interface/billing/edi_270.php`, `era_payments.php`). **الحد الأدنى**: دالة توليد ملف مطالبة CSV/X12-مبسط قابل للتنزيل من `billing-claims.tsx` + استيراد ملف تسوية (remit) بصفوف.
5. **[متوسطة] توسيع FHIR للكتابة + OAuth2**: خادم BMC للقراءة فقط بلا مصادقة قياسية؛ أي تكامل مستقبلي (تطبيق شريك، تأمين) يحتاج OAuth2 client_credentials. OpenEMR يقدم FHIR US Core + SMART (`apis/routes/`, `oauth2/`). **الحد الأدنى**: توثيق نطاق القراءة الحالي في docs/API.md + إضافة write-scope محدود لموارد Appointment عبر توكن شريك مخزن في Setting.
6. **[متوسطة] الرصد الوبائي/بلاغات الصحة العامة**: OpenEMR (`module/Syndromicsurveillance`) يجمع متلازمات للصحة العامة؛ نظيرها البحريني إخطارات NHRA (العدوى المعدية). **الحد الأدنى**: تقرير "أمراض قابلة للإخطار" في ops-reports يفلتر Problems بتشخيصات من قائمة NHRA + نموذج تصدير CSV موقّع.
7. **[منخفضة] محرر نماذج/قوالب ديناميكي (LBF)**: أعلى ميزة معمارية لدى OpenEMR لكنها ليست ضرورة تشغيلية لمركز واحد بـ 10 أقسام موصوفة في المواصفة؛ تكلفتها عالية (محرك تخزين JSON + مولد واجهة). **التوصية**: تأجيل، والاكتفاء بإضافة حقول JSON مرنة (`encounter.extensions Json`) لأي بيانات غير قياسية.
8. **[منخفضة] جلسات العلاج الجماعي، Telehealth، Fax**: غير مطلوبة في مواصفة BMC (§2.3 لا تذكرها) — توثيق كقرار نطاق (out-of-scope) بدل تنفيذ.

## التوصيات

- **الأسبوع القادم (بلا مخاطر معمارية)**: مسارات التطعيم + المستدعيات (فجوتان 1-2 أعلاه) — كلاهما يبنى فوق نماذج موجودة أصلاً في `prisma/schema.prisma` (Immunization, Waitlist) فلا يتطلب migration.
- **قبل الربط مع أي شركة تأمين حقيقية**: صياغة صيغة مطالبة قابلة للتصدير (فجوة 4) وتثبيت عقد الـ webhook الداخلي.
- **قرارات نطاق موثقة**: إضافة قسم "Out of scope by design" في docs/API.md يذكر LBF/Telehealth/Fax/CQM الأمريكية حتى لا تُحسب فجوات عند أي تدقيق مستقبلي.
- **نقاط تفوق يجب صيانتها**: سلسلة هاش التدقيق، تصعيد التنبيهات الحرجة، قائمة الانتظار المرجحة، Levey-Jennings — لا نظير مباشر لها في OpenEMR بتلك الصيغة.
