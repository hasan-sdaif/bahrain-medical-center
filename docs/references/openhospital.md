# Open Hospital — دراسة مرجعية ومطابقة مع BMC

> Task ID: R1 · النسخ المدروسة: `reference-systems/openhospital-core` (الخادم Java/Spring)، `reference-systems/openhospital-ui` (واجهة React)، `reference-systems/openhospital` (حزمة التوزيع). وثيقة بحثية — لا تغييرات على كود التطبيق.

## نظرة عامة

Open Hospital هو نظام إدارة مستشفيات مفتوح المصدر (Java Spring Boot + React) طوّرته منظمة Informatici Senza Frontiere للمستشفيات في الدول النامية، وتركيزه **الرعاية الداخلية (IPD)**: الأقسام والأسرّة، القبول/الخروج، الولادات، برامج سوء التغذية، والصيدلية المخزنية على مستوى المستشفى والقسم. يتكون الخادم من 49 حزمة Java تحت `src/main/java/org/isf/` (منها 44 حزمة نطاق ببنية model/manager/service صارمة و79 صنف كيانات)، والواجهة من أنشطة Activities (فواتير، مختبر، زيارات، تفاصيل مريض) وملحقات Accessories (قبول، فرز، حجز، عمليات، علاج).

**الخلاصة المركزية للمقارنة**: BMC أقوى في كل ما هو **عيادات خارجية رقمية**: طابور مرجّح، LIS بتحقق آلي وQC، أشعة بتقارير BI-RADS/TI-RADS، فوترة تأمين بفلس/VAT، سحب منزلي موجه، CMMS، جودة CAPA، بوابة مريض وكشك. Open Hospital أقوى في ما هو **إدارة مستشفى**: الأقسام والأسرّة، القبول/الخروج بالتشخيص الداخل/الخارج، جدول العمليات الجراحية بأنواع مرجعية، الصيدلية الفرعية لكل قسم + الجرد الفعلي (stock-take) + قوائم أسعار متعددة، الولادة وسوء التغذية كبرامج، وتخزين DICOM حقيقي. أغلب فروق IPD **خارج نطاق مواصفة BMC بالتصميم** (المركز عيادات خارجية + جراحة يومية)، وتوثَّق هنا كقرار نطاق لا كخلل.

أدلة الجرد: `openhospital-core/src/main/java/org/isf/*/model/` (79 ملف أصناف كيانية)، `openhospital-ui/src/routes/` (المسارات)، `openhospital-ui/src/components/activities/` + `accessories/` (الشاشات).

## جرد القدرات والمطابقة

| القدرة | الموقع في الأصل | مقابلها في BMC | الحالة |
|---|---|---|---|
| سجل المرضى (وبيانات موسعة: فصيلة دم، مهنة، أقرب الأقارب، أسماء الوالدين) | `org/isf/patient/model/Patient.java` + UI searchPatient/newPatient | `Patient` + `PatientIdentifier` (MPI بنسخة أصلية Luhn) + `reception-register.tsx` | مغطى |
| صورة شخصية للمريض (كاميرا ويب + قصّ) | `patient/PatientProfilePhoto.java` + UI `webcam/`, `profilePictureCropper/` | لا توجد صورة شخصية (الباركود MRN هو المعرّف البصري) | جزئي |
| دمج الملفات المكررة | `patient/PatientMergedEvent.java` | `core.ts` patients/merge + نقاط التطابق الضبابي | مغطى |
| الأقسام (Wards) وسعة الأسرّة والنوع ذكر/أنثى | `org/isf/ward/model/Ward.java` + UI admin/wards | نموذج `Department` + `ServicePoint` — **لا إدارة أسرّة** (مركز خارجي) | فجوة (خارج النطاق بالتصميم) |
| القبول/الخروج IPD (نوع قبول، تشخيص دخل/خارج 1-3، وحدة محيلة، وحدات نقل دم) | `org/isf/admission/model/Admission.java` + UI `admission/`, `discharge/` | لا يوجد قبول داخلي؛ أقرب شي: مسار الجراحة (preop gate §17 + encounter) | فجوة (خارج النطاق — توثيق) |
| بيانات الحمل والولادة (نوع/نتيجة ولادة، علاج حمل) | حقول في `Admission.java` (pregTreatmentType, deliveryDate/Type/Result) + `dlvrtype/`, `dlvrrestype/` | لا وحدة توليد (لا يوجد قسم نسائية بين الأقسام العشرة) | فجوة (خارج النطاق — لا قسم توليد) |
| برنامج سوء التغذية | `org/isf/malnutrition/model/Malnutrition.java` | قسم تغذية + `GrowthRecord` بمئينات LMS (WHO) §17 — دون سجل برنامج متابعة | جزئي |
| زيارات OPD (جديد/عودة، إحالة داخل/خارج، تشخيص 1-3، زيارة قادمة) | `org/isf/opd/model/Opd.java` (nextVisit, referralFrom/To) + UI `patientOPD/` | `Encounter` + SOAP + `Referral` (بSLA) + followUpDays في finish-visit | مغطى (أغنى) |
| جولات التمريض على الأقسام (Visits) | `org/isf/visits/model/Visit.java` (ward|null) + UI visitsActivity | لا يوجد (تابع لغياب IPD) | فجوة (خارج النطاق) |
| الفرز/الفحص التمريضي (طول/وزن، ضغط min/max، نبض، حرارة، تشبع، تنفس، سمع رئتين، بول، حركة أمعاء) | `org/isf/examination/model/PatientExamination.java` + UI `patientTriage/` | `emr-vitals.tsx` 9 حقول + BMI محسوب (§17) | مغطى (BMI إضافة) |
| المختبر (طلب فحوص، إدخال نتائج، طباعة) | `org/isf/exa/` (Exam/ExamRow) + `org/isf/lab/` (Laboratory, LaboratoryStatus, LaboratoryForPrint) + UI laboratoryActivity | `lab.ts` كامل: عينات، استلام/رفض، نتائج، تحقق آلي §17.9، تنبيه حرج متصعد، QC Levey-Jennings، HL7 محاكى | مغطى (أقوى بكثير) |
| الأشعة/DICOM بتخزين ملفات فعلي (Accession Number، اسم منشأة) | `org/isf/dicom/` (FileDicom, DicomData, DicomType) | `ImagingStudy` + تقرير BI-RADS/TI-RADS + لوحة PACS محاكاة (canvas توضيحي بلا ملفات DICOM) | جزئي |
| العمليات الجراحية (جدول عمليات بأنواع مرجعية + أسطر بنود) | `org/isf/operation/` (Operation, OperationRow) + `opetype/` + UI patientOperation + admin/operations | بوابة preop §17.13 (قائمة تحقق قبل الجراحة) + encounter جراحي — **لا جدول عمليات ولا فهرس أنواع عمليات** | جزئي |
| التطعيمات (جدول تطعيمات + سجل مريض) | `org/isf/vaccine/`, `patvac/` (PatientVaccine) + UI admin/vaccines | نموذج `Immunization` للقراءة فقط (FHIR + chart) — لا إدخال ولا إدارة | **فجوة** |
| خطط العلاج الدوائي (تواريخ متعددة، جرعة/تكرار يومي، تنبيه SMS لكل جرعة) | `org/isf/therapy/model/Therapy.java` (dates[], freqInDay, notify, sms) + UI patientTherapy | `Prescription` + `PrescriptionItem` + طلب تجديد من بوابة المريض — لا خطة أيام بتنبيهات جرعات | جزئي |
| الصيدلية المخزنية: دفعات Lot + حركات + موردين | `org/isf/medicalstock/` (Lot, Movement, MovementLog) + `supplier/` | `Batch` + `StockMove` + `Supplier` + صرف FEFO §17 في `pharmacy.ts` | مغطى |
| صيدلية القسم (رصيد فرعي لكل Ward + حركات بين الأقسام) | `org/isf/medicalstockward/` (MedicalWard, MovementWard) | `BinLocation` (مواقع تخزين) — بلا رصيد لكل نقطة خدمة | جزئي |
| الجرد الفعلي (جلسات عدّ بموافقة/فرق) | `org/isf/medicalinventory/` (MedicalInventory, InventoryRow, InventoryStatus) | لا يوجد عدّ فعلي — الحركات فقط (وارد/هدر/إرجاع) | جزئي |
| قوائم الأسعار المتعددة (لكل قسم أو مريض + أسعار أخرى) | `org/isf/priceslist/` (PriceList, Price), `pricesothers/` | `ServiceItem` (سعر موحد بفلس) + حصة التأمين في `InsurancePolicy` + `Package` | جزئي (سعر واحد قائمةً) |
| الفوترة (فاتورة بنود + دفعات + ربط بقبول/مريض + ملخص ومراجعة) | `org/isf/accounting/` (Bill, BillItems, BillPayments) + UI billingActivity/billsRecap | `Invoice/InvoiceLine/Payment` + VAT §17.14 + مطالبات تأمين + سلف + ورديات الصراف | مغطى (أقوى بكثير) |
| فهرس الأمراض (داخل/خارج، أنواع) | `org/isf/disease/` + `distype/` | `Problem` بترميز ICD-10 + فلاتر chart | مغطى |
| السوابق المرضية العائلية المنظمة (Anamnesis) | `org/isf/anamnesis/` (PatientHistory, PatientPatientHistory) | `PatientRelationship` (تابعون) + حساسيات + مشاكل — **لا تاريخ عائلي منظم** | جزئي |
| محتوى الترخيص/الموافقة لكل مريض (patconsensus) | `org/isf/patconsensus/model/PatientConsensus.java` | 19 قالب موافقة + توقيع بمدة قراءة إلزامية + تحقق QR | مغطى (أقوى) |
| المستخدمون والصلاحيات (مجموعات + صلاحية لكل قائمة) | `org/isf/permissions/` (Permission, GroupPermission) + `menu/` (GroupMenu, UserMenuItem) | `perm.ts` مصفوفة RBAC §5.3 + me/modules لكل دور | مغطى |
| تدقيق الجلسات | `org/isf/sessionaudit/` (SessionAudit, UserSession) | `AuditEvent` بسلسلة هاش + break-glass + سجل وصول المريض | مغطى (أقوى) |
| رسائل SMS مجدولة مرتبطة بالوحدات | `org/isf/sms/model/Sms.java` (smsDateSched, module, moduleID) | `Notification` (قناة sms محاكاة) + تذكيرات Scheduler | جزئي |
| محادثة داخلية XMPP | `org/isf/xmpp/` | `MessageThread` داخلية + دردشة أوامر العمل (WO) | مغطى (تقنية مختلفة) |
| لوحة مؤشرات (قبولات/خروج/عيادات) | UI `dashboard/` (بطاقات admissions/discharges/opds) | `staff/core.ts` board + `ops-metrics` + تقارير 10 KPI | مغطى |
| حجز مواعيد | UI `patientBooking/` | مواعيد بفتحات + حجز ويب `WebBooking` + waitlist (غير مفعلة) | مغطى |
| ملخص سريري للمريض (ورقة عيادة) | UI `patientSummary/` | `emr-chart.tsx` (ملخص: حساسيات، مشاكل، أدوية، مؤشرات، لقاءات) | مغطى |
| طباعة نماذج خدمة مخصصة | `org/isf/serviceprinting/` | مناطق طباعة (ملصق عينة، إيصال، تذكرة) + قوالب تقارير ثابتة | جزئي |
| تقارير إحصائية بمحرك JasperReports (قوالب .jrxml) | `org/isf/stat/` + `rpt_base/` | recharts في ops-reports (10 مؤشرات) + تصدير محكوم معطل | جزئي |
| قواميس الأنواع القابلة للتحرير (نوع قبول/خروج/فحص/عملية/تطعيم/حركة/عمر…) | حزم `*type/` + UI admin/types | `Setting` + اتحادات ثابتة في `lib/types.ts` + FeatureFlag — لا CRUD قواميس عام | جزئي |
| بيانات المنشأة (اسم/عنوان/عملة) | `org/isf/hospital/model/Hospital.java` + UI admin/hospital | `Setting` + CMS + هوية الموقع العام | مغطى |
| القياس عن بُعد (telemetry اختياري) | `org/isf/telemetry/` | لا يوجد | فجوة (منخفضة — غير مطلوب) |
| تعدد اللغات في الواجهة | UI `langSwitcher/` (EN/IT/FR…) | ar/en ثنائية أصلية RTL/LTR | مغطى |
| استعادة كلمة المرور/تغييرها | UI forgotActivity, changePasswordActivity | بوابة الموظفين + جلب جلسات — تغيير كلمة المرور عبر admin | جزئي |

## الفجوات ذات الأولوية

1. **[عالية] سجل التطعيمات بلا إدخال ولا إدارة** (تتكرر مع استنتاج OpenEMR): BMC لديه قسم أطفال و`Immunization` للقراءة فقط. لدى OH نموذجان (Vaccine + PatientVaccine) وشاشة إدارة. **الحد الأدنى**: شاشة إدخال تطعيم في EMR + فهرس لقاحات (رمز/اسم/جدول جرعات) في الإعدادات + إظهار السجل في chart وFHIR (موجود أصلاً).
2. **[متوسطة] جدول العمليات الجراحية وأنواعها**: BMC يضم 3 أقسام جراحية (جراحة عامة، ثدي، مسالك) وبوابة pre-op، لكن دون فهرس أنواع عمليات ولا جدولة "غرفة + وقت + فريق". OH: `operation/Operation.java` (نوع + أسطر بنود) و`opetype/`. **الحد الأدنى**: نموذج `Operation` خفيف (نوع مرجعي + موعد + غرفة + فريق من CareTeamMember) مربوط بال encounter الجراحي وبوابة preop، ويعرض في board.
3. **[متوسطة] الجرد الفعلي للصيدلية/المخازن (stock-take)**: OH `medicalinventory` يجلس عدّاً فعلياً بحالة (مسودة/مكتمل/ملغى) وفرق عدّ؛ BMC يسجل الحركات فقط فلا يمكن اكتشاف الفاقد الصامت. **الحد الأدنى**: جدول `StockCount` + `StockCountLine` (كمية دفترية/فعلية/فرق) وشاشة عدّ في ops-inventory تنشئ تسوية `StockMove` بنوع adjustment.
4. **[متوسطة] رصيد لكل نقطة خدمة/غرفة عمليات (صيدلية فرعية)**: OH يفصل رصيد المستودع عن رصيد القسم (medicalstockward). BMC يملك `BinLocation` (أماكن) لكن صرف `pharmacy/dispense` يخصم من الدفعة مباشرة دون رصيد لكل نقطة. **الحد الأدنى**: حقل `ownerServicePointId` على Batch (أو جدول رصيد) — منخفض التكلفة إذا استُخدم BinLocation كمستوى قسم.
5. **[منخفضة–متوسطة] تاريخ عائلي منظم (Anamnesis)**: OH يخزن أنماط تاريخ مرضي مرتبطاً بالمريض؛ BMC يخزن التابعين (علاقة) فقط. مفيد لعلم الوراثة (سرطان ثدي/غدد). **الحد الأدنى**: حقل JSON `familyHistory` على Patient (علاقة + حالة + مرض) يُظهر في emr-chart.
6. **[منخفضة] خطة جرعات مجدولة بتنبيهات (Therapy)**: OH ينشئ خطة أيام بإشعار SMS لكل جرعة؛ BMC ينشئ وصفة ثابتة. يمكن محاكاته بتوسيع Prescription بجدول أيام اختياري — أولوية منخفضة لأن نمط الوصفة البحريني (صيدلية خارجية/داخلية) لا يتطلب تتبع جرعات يومية.
7. **[منخفضة] صورة شخصية للمريض**: OH يربط صورة بالملف؛ BMC يعتمد باركود MRN فقط — قرار أمان خصوصية مقبول (توثيق)، أو إضافة صورة اختيارية مشفّرة لاحقاً.
8. **[خارج النطاق بالتصميم — توثيق إلزامي]**: الأقسام والأسرّة (Ward)، القبول/الخروج IPD، جولات التمريض، الولادة/الحمل، telemetry: كلها غير مطلوبة في مواصفة مركز عيادات خارجية بجراحة يومية. يجب توثيقها كقرار نطاق حتى لا تُحسب فجوات في أي مطابقة مستقبلية (مثلاً إذا أضاف المركز مراقبة ما بعد التخدير).

## التوصيات

- **مكاسب سريعة بلا migration**: التطعيمات (نموذج موجود) والتاريخ العائلي (JSON على Patient) — كلاهما يوفر قيمة سريرية فورية ويسد فجوتين أمام أي تدقيق مرجعي.
- **قبل تشغيل الصيدلية فعلياً**: تنفيذ الجرد الفعلي (فجوة 3) لأن اكتشاف الفاقد بعد الحركة فقط شبه مستحيل — وهو متطلب GPP صيدلي معتاد.
- **عند إضافة أي غرفة عمليات ثانية**: عندها يصبح جدول العمليات (فجوة 2) ضرورة تشغيلية لا رفاهية.
- **نقاط تفوق BMC يجب صيانتها عند أي مقارنة مستقبلية**: MPI بباركود وLuhn، الفرز بـBMI، LIS بتحقق آلي وQC وLevey-Jennings وتصعيد حرج، الفوترة بVAT/تأمين/سلف/ورديات، الموافقات بمدة قراءة إلزامية وتحقق QR، سلسلة تدقيق هاش، CMMS كامل، السحب المنزلي الموجه — OH لا يقدم أي نظير لهذه.
- **مرجعية الطبقات**: بنية OH (model/manager/service لكل نطاق + DTO) تؤكد صحة تقسيم BMC (server/staff لكل نطاق + أنواع صريحة في lib)؛ لا تغيير معماري مطلوب.
