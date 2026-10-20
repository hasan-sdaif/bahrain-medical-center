# مرجعية Bahmni (مقارنة مع BMC)

> المصدر: النسخة المحلية `reference-systems/bahmni-core` (الإصدار 3.1.0-SNAPSHOT — وفق `pom.xml`). Bahmni توزيعة فوق OpenMRS تجمع EMR + مخبر (OpenELIS) + أشعة (dcm4chee/Othanc) + فوترة (تكامل ERP) في تدفق رعاية واحد.
> الهدف: جرد قدرات Bahmni على مستوى تدفق الرعاية والخدمات، ومقارنتها بـ BMC بصراحة.

## نظرة عامة

بنية المستودع: `bahmnicore-api` (خدمات المجال) + `bahmnicore-omod` (متحكمات REST على OpenMRS REST v1.0/v2.0) + `bahmni-emr-api` (حسابات Obs) + `admin` (استيراد/تصدير CSV بالجملة) + `obs-relation` (علاقات ملاحظات) + `openmrs-elis-atomfeed-client-omod` (تكامل المختبر عبر Atom Feed) + `bahmni-mapping`.

تدفق الرعاية في Bahmni (الجوهر المطلوب في §2.3): **تسجيل → فرز (Triage) → استشارة → أوامر (مختبر/أشعة/أدوية) → نتائج → disposition (قرار) → فواتير**، والزيارة (`VisitSummary`) هي وعاء الجلسة الواحدة الذي تُربط به التوثيقات والنتائج. الأدلة:

- `bahmnicore-api/src/main/java/org/bahmni/module/bahmnicore/contract/visit/VisitSummary.java` — ملخص الزيارة مع تفاصيل دخول IPD.
- `bahmnicore-omod/.../web/v1_0/controller/BahmniEncounterController.java` — حفظ الاستشارات/الفرز.
- `bahmnicore-omod/.../controller/display/controls/BahmniLabOrderResultController.java` — جلب نتائج المختبر المرتبطة بالزيارة.
- `bahmnicore-omod/.../controller/BahmniDispositionController.java` — قرار نهاية الزيارة (متابعة/إحالة/دخول).

## جرد القدرات مقابل BMC

| القدرة (Bahmni) | الدليل من النسخة | مقابلها في BMC | الحالة |
|---|---|---|---|
| تسجيل المريض + كشف التطابق (Duplicate matching) | `bahmnicore-api/.../service/impl/BahmniEncounterMatchDecisionServiceImpl.java`, `matcher/` | `patients/register` + درجة تطابق عربية (dedup score في `src/lib/arabic.ts`) + `POST patients/merge` | ✔ (BMC أقوى عربيًا) |
| فرز Triage → استشارة داخل زيارة واحدة | `VisitSummary.java`, `encounterModifier/` (ملء تلقائي للتوثيق) | `Encounter.status` يحتوي `triage→awaiting-doctor→in-exam→…` + `POST vitals` (`src/server/staff/clinical.ts`) | ✔ (كصف واحد بدل توثيقين) |
| لوحة الحضور/طابور الزيارات لكل طبيب | `contract/visit/VisitSummary.java` + `BahmniVisitService.getLatestVisit()` | `GET board` + `QueueTicket` بأوزان أولوية §17 + `GET queue/list` + شاشة queue.website.bh | ✔ |
| أوامر موحدة مختبر/أشعة/أدوية من الاستشارة | `BahmniOrderController.java`, `BahmniDrugOrderController.java`, `contract/drugorder/DrugOrderConfigResponse.java` | CPOE `POST orders` (lab/imaging) + `POST prescriptions` مع فحوص أمان | ✔ |
| **بروتوكولات دوائية (Regimens) وجدولة الدواء** | `DrugOrderToRegimenMapper.java`, `BahmniDrugOrderServiceImpl.java` | وصفة ببنود + جرعات وزنية (weight dosing §17) — لا "regimen tabular" للكيماوي | ◐ |
| ربط النتائج المخبرية بالزيارة + عرضها في الاستشارة | `BahmniLabOrderResultController.java`, `admin/.../LabResultPersister.java` | `LabResult` + autoverify/delta (`src/lib/algorithms.ts`) + تنبيهات حرجة `CriticalAlert` | ✔ (مع Westgard QC الذي لا يوجد في Bahmni core) |
| تكامل LIS عبر Atom Feed (OpenELIS) مع mapping للـ accession | `openmrs-elis-atomfeed-client-omod/.../OpenElisPatientFeedClientImpl.java`, `AccessionHelper.java` | لا Feed — `POST lab/analyzer-push` مباشر + جسر FHIR (`src/server/fhir.ts`) | ◐ (نمط مختلف؛ لا يوجد اشتراك feed ولا إعادة محاولة FailedEvents — يوجد `FailedEventsFeedClient.java` عند Bahmni) |
| علاقات Obs الأب/الابن | `obs-relation/.../ObsRelationship.java` | `soap`/`refRange` Json بهيكلة ثابتة | ◐ |
| **قوالب ملخص الأمراض (Disease Templates) + Trends/FlowSheets + Drug-O-Gram** | `DiseaseTemplateController.java`, `BahmniTrendsController.java`, `ObsToObsTabularFlowSheetController.java`, `DrugOGramController.java`, `BahmniDiseaseSummaryController.java` | مخططات نمو WHO فقط (`GrowthRecord` LMS) + سجل مخبري في البوابة — لا flowsheet قابل للتهيئة للأمراض المزمنة | ✖ مفقود |
| **برامج المرضى والمسارات العلاجية (Patient Programs)** | `BahmniProgramWorkflowService.java` (يمتد ProgramWorkflowService), `BahmniProgramEnrollmentResource.java` في omod, `admin/.../PatientProgramPersister.java` | `Pathway`/`PathwayInstance` في `schema.prisma:1055` **بلا أي API/UI** (بذرة فقط `prisma/seed-part2.ts:671`) | ◐ نموذج بلا تشغيل |
| Disposition موحّد بنهاية الزيارة | `BahmniDispositionController.java` | `POST encounters/finish-visit` + `plan`/`instructionsAr/En` + `followUpAt` | ◐ (قرار حر النص، لا مفردات disposition منظمة) |
| محرر أشكال مع مسودات (Form Builder + Drafts) | `FormDraftController.java`, `BahmniFormDetailsController.java`, `forms2/` | أشكال ثابتة مبرمجة (EMR 20 تبويبًا) | ✖ (خيار تصميمي) |
| بحث المصطلحات السريرية أثناء التوثيق | `TsConceptSearchService.java`, `BahmniConceptSearchController.java` | قوائم مدمجة (أدوية/فحوصات/ICD10) بلا بحث مركزي موحد | ◐ |
| هرمية عناوين (Address Hierarchy) | `BahmniAddressHierarchyService.java`, `BahmniAddressHierarchyController.java` | قوائم بحرينية ثابتة (محافظات/مناطق/بلوكات) في `src/lib/bahrain.ts` | ✔ للنطاق البحريني (غير قابلة للتوسع خارجها) |
| مخزون المستودع (عبر تكامل ERP) | `InventoryStockController.java`, `InventoryStockService.java`, `contract/stock/` | `Item`/`Batch`/`StockMove`/`BinLocation` + FEFO في `src/server/staff/ops.ts` | ✔ (داخلي بدل التكامل) |
| صور المريض (Patient Photos) | `BahmniPatientImageController.java` (v2_0 + v1_0) | لا يوجد | ✖ (منخفضة الأثر) |
| **استيراد/تصدير CSV بالجملة (ترحيل بيانات)** | `admin/src/main/java/org/bahmni/module/admin/csv/` — `PatientPersister`, `EncounterPersister`, `LabResultPersister`, `PatientProgramPersister`, `DrugPersister`, `RelationshipPersister` + `exporter/` | لا يوجد (بذور seed برمجية فقط) | ✖ مفقود |
| تقارير SQL قابلة للتهيئة (Report Runner) | `SqlSearchController.java`, `SqlSearchService.java`, `TasksMonitoringController.java` | `GET reports/overview` + تصدير محكوم في `ops-reports.tsx` (ثابت) | ◐ |
| تصدير/استيراد إداري (Admin Export/Import) | `AdminExportController.java`, `AdminImportController.java` | لا يوجد | ✖ (منخفضة–متوسطة) |
| أحداث النظام وAtom Feeds للتكامل الخارجي | `events/eventPublisher/`, `events/eventListener/`, `BahmniFeedDrugOrders.java` | socket.io داخلي (mini-services/realtime:3003) + Webhooks دفع Benefit — لا Feeds صادرة | ◐ |
| الفوترة (عبر تكامل ERP خارج هذا المستودع) | خارج النطاق في هذا clone | فوترة كاملة داخلية: فاتورة VAT BHD + مطالبات + موافقات مسبقة + وردات صندوق (`src/server/staff/billing.ts`) | ✔ (BMC مكتمل داخليًا) |
| وصفة إلكترونية بفحوص أمان | `BahmniDrugOrderController.java` + `contract/drugorder/` | تفاعلات/حساسية/حمل/جرعات وزنية (§17) في `src/lib/algorithms.ts` + `pharmacy/dispense` FEFO | ✔ (BMC أوسع فحوصًا) |
| طابور ووردات متعددة الخدمات | `contract/monitoring/`, `TasksMonitoringController.java` | `ServicePoint` + `QueueTicket` + عرض kiosk/queue | ✔ |

## الفجوات ذات الأولوية

1. **عالية — قوالب الأمراض والـFlowsheets**: Bahmni توفر `DiseaseTemplateController` و`ObsToObsTabularFlowSheetController` لرصد مسار مرض مزمن (HbA1c/كرياتينين عبر الزيارات) بتهيئة بلا كود. BMC لا تملك سوى مخططات النمو؛ مرضى الغدد الصماء والأورام بحاجة لعرض زمني مجمع للنتائج والأدوية (Drug-O-Gram).
2. **عالية — تشغيل البرامج العلاجية**: النموذج جاهز (`Pathway`) والتاريخ مطلوب سريريًا (أورام/نفسية/تغذية) لكن لا مسارات ولا واجهة — الفجوة نفسها الموثقة في `openmrs.md`.
3. **متوسطة — استيراد/ترحيل بيانات CSV**: وحدة `admin/csv` عند Bahmni تتيح تهيئة المنظومة من بيانات قديمة (مرضى/توثيقات/نتائج/برامج). عند BMC أي ترحيل يتطلب كتابة سكربت Prisma — يجب توثيق ذلك كخطر تشغيلي قبل الإطلاق الفعلي.
4. **متوسطة — أنماط تكامل LIS المتراكمة**: Atom Feed مع إعادة محاولة الأحداث الفاشلة (`FailedEventsFeedClient.java`) يضمن عدم فقدان النتائج؛ `lab/analyzer-push` عندنا بدون طابور إعادة محاولة. التوصية: تسجيل كل push في جدول وارد + إعادة معالجة.
5. **منخفضة — مفردات Disposition منظمة، صور المريض، بحث مصطلحات مركزي، Admin Export**: إضافات لطيفة لا تعيق العمليات اليومية لمركز خارجي.

## التوصيات

1. بناء شاشة "مسار المريض المزمن" (Flowsheet) فوق بيانات موجودة أصلاً: `LabResult` + `Problem` + `PrescriptionItem` — استعلام واحد زمني + جدول محاور (تواريخ × مقاييس) في `emr-chart.tsx`؛ يعادل DiseaseTemplate دون الحاجة لقاموس مفاهيم.
2. تفعيل `PathwayInstance` بخدمتين (enroll/transition) وتبويب EMR صغير — انظر التفصيل في `openmrs.md` (التوصية 2).
3. إضافة أداة CSV استيراد مقيدة الصلاحيات (sysadmin) لجدولين فقط كبداية: المرضى والملاحظات المخبرية، مع التحقق بـ`arabic.ts` وblindIndex لمنع التكرار — يقلل خطر الترحيل اليدوي.
4. توثيق قرار "لا Atom Feeds" واعتماد Webhooks/REST الفوري مع تتبع التسليم في `PaymentWebhook`/تحليلات الدفع كنمط موحد للتكاملات الصادرة.
5. إضافة مفردة disposition (متابعة/إحالة/دخول/مخروج ضد النصائح) كحقل مصفوفة على `Encounter` — جهد ضئيل، ويحسّن تقارير الجودة لاحقًا.
6. تسجيل كل `POST lab/analyzer-push` في جدول "وارد المحللات" مع محاولة إعادة تلقائية للأحداث الفاشلة — يعادل نمط `FailedEventsFeedClient.java` عند Bahmni دون تبني Atom Feed كامل.

## ملخص الحالة النهائية

ميزان BMC مقابل Bahmni إيجابي في: MPI عربي أقوى، طابور بأوزان أولوية، QC مخبري (Westgard/delta/autoverify) غير موجود في Bahmni core، فوترة ومطالبات داخلية كاملة، وسحب منزلي بتحسين 2-opt. الفجوات الجوهرية محصورة في: Flowsheets الأمراض المزمنة، تشغيل البرامج العلاجية (نموذج جاهز بلا API)، وأدوات الترحيل بالجملة — وكلها قابلة للإغلاق فوق النموذج الحالي دون هندسة جديدة كما فصّلت التوصيات أعلاه.
