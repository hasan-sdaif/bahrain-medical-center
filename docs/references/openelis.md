# مرجع: OpenELIS Global 2 — دراسة مقارنة وتحليل فجوات (R3)

> النظام: OpenELIS Global 2 — نظام معلومات مختبرات (LIS) مفتوح المصدر (Java/Spring + React)، مرجع الـ CLSI للمنطقة.
> المسار المحلي: `reference-systems/openelis` (backend: `src/main/java/org/openelisglobal/` — 167 حزمة؛ frontend: `frontend/src/` — 55 مكونًا).

## نظرة عامة

OpenELIS هو أعمق الأنظمة الخمسة في **علم المختبر التشغيلي**: خطط عمل (workplans) لكل قسم اختبار، مسار عينة كامل من الطلب الإلكتروني حتى التحقق والتصدير، ضبط جودة بقواعد Westgard كاملة مع مخططات Levey-Jennings وسلاسل مواد الضبط، إدارة كواشف/دفعات مرتبطة بالاختبارات والـ QC، وواجهات أجهزة محللة ثنائية الاتجاه. كتب التطبيق المرجعي إلينا أغلب مفاهيم §17.9 (autoverify/delta/critical) لكن بقرارات تبسيط واعية.

## جرد القدرات (القدرة | مقابلها في BMC | الحالة)

| # | القدرة في OpenELIS (الدليل) | مقابلها في BMC | الحالة |
|---|---|---|---|
| 1 | خطط عمل مرنة: بالقسم/الاختبار/الأولوية/اللوحة (`frontend/src/components/workplan/Workplan.jsx` + `batchworkplan` backend) | قائمة سحب واحدة مرتبة STAT أولًا + قائمة عينات (`lab-phleb.tsx`, `lab-worklist.tsx` ← `lab.ts:22-68`) | جزئي — لا تصفية بقسم/لوحة |
| 2 | إدخال طلبات: فردي/دفعي/تعديل/طلب إلكتروني eOrder (`frontend/src/components/{addOrder,batchOrderEntry,modifyOrder,eOrder}/`) | الطلبات تُنشأ من EMR (emr-orders) — لا إدخال طلب خارجي مباشر بالمختبر | مكافئ عبر EMR |
| 3 | مسار العينة + باركود GS1/طباعة (`barcodeWorkflow/`, `printBarcode/`, `inventory/gs1.js`) | Code128 تشغيلي لكل الكيانات + ملصق عينة قابل للطباعة + سلسلة حيازة مزدوجة المسح (`lab.ts:70-87` chain) | مكافئ (نموذج أبسط) |
| 4 | التحقق من النتائج: مراجعة جماعية + فرز triage (`frontend/src/components/validation/{Validation.jsx,ValidationReviewPanel.jsx,validationTriage.js}`) | شاشة نتائج: إدخال → قرار آلي (QC/flag/delta) → اعتماد وإصدار يدوي (`lab-results.tsx` ← `lab.ts:88-137`) | مكافئ وظيفيًا |
| 5 | Westgard كامل: 1-3s, 1-2s, 2-2s, R-4s, 3-1s, 4-1s, 7-T, 10-x + تقييم متعدد النقاط (`src/main/java/org/openelisglobal/qc/service/evaluator/` — 11 مقيّمًا؛ إعدادات في `liquibase/qc/002-create-westgard-rule-config.xml`) | عتبة نسبية مبسطة ±7%/±15% بوسم 1-3s/2-2s + Levey-Jennings بمقاطع ±1SD/±2SD (`lab.ts:169-181`, `lab-qc.tsx`) | فجوة متوسطة — مبسط |
| 6 | مواد الضبط controlLots + لوحة QC + قواعد قابلة للتهيئة (`frontend/src/components/qc/{controlLots,ruleConfig,dashboard}/`) | مستويات L1-3 ضمن qcRun واحد لكل اختبار | جزئي — لا دفعات مواد ضبط |
| 7 | مخزون كواشف مرتبط بالاختبارات: دفعات، نفاذ، تخلص، استلام تسليم، اقتراح إعادة طلب، **حالة QC للدفعة** (`frontend/src/components/inventory/{LotDetailsPanel,DisposeLotModal,ReorderSuggestionsModal,UpdateQCStatusModal}.jsx`; ربط اختبار-كاشف: `org/openelisglobal/testreagentlink/`) | مخزون CMMS عام: lotNo/انتهاء/FEFO/حد إعادة الطلب (`ops-inventory.tsx`) — **غير مرتبط بالاختبارات أو QC** | فجوة متوسطة-عالية |
| 8 | أجهزة محللة ثنائية الاتجاه: إعداد، ربط نوع، **BridgePairing**، قراءات HL7/ASTM، أخطاء (`frontend/src/components/analyzers/`; `org/openelisglobal/{analyzer,analyzerimport,analyzerresults}/`; عينة اختبار `src/test/resources/testdata/hl7/sysmex-xn-result.hl7`) | محاكي دفع أحادي الاتجاه ORU^R01 (`lab.ts:149-163` "same adapter a real HL7/ASTM bridge would use") | فجوة عالية — اتجاه واحد فقط |
| 9 | تنبيهات قابلة للتهيئة حسب العمر/الجنس/النطاق (`org/openelisglobal/testalertrule/`) + **توثيق اتصال القيمة الحرجة** (CriticalCallbackModal.jsx في `resultPage/`) | تنبيه حرجة + تصعيد 0/10/20 دقيقة + إقرار "قرأتُ وفهمت" + سجل تصعيد (`lab.ts:138-147`, `lab-critical.tsx`) | BMC أقوى في التصعيد؛ OpenELIS أقوى في توثيق الاتصال الهاتفي |
| 10 | اختبارات انعكاسية Reflex + محسوبة (`org/openelisglobal/testreflex/`, `testcalculated/`) | غير موجود | فجوة متوسطة |
| 11 | كتالوج اختبارات: أكواد LOINC، تفسيرات، مكونات (`testcodes/`, `testresultcomponent/`) | `labTest.loinc` موجود ويُصدَّر في FHIR (`fhir.ts:92`) | مكافئ |
| 12 | تخصصات: ميكروبيولوجيا + WHONet، أنسجة/خلايا/مناعة-نسجية، ناقلات (`frontend/src/components/{microbiology,pathology,cytology,immunohistochemistry,vectorIdentification}/`) | خارج نطاق BMC الحالي | فجوة مقصودة (خارج المواصفة) |
| 13 | أحداث عدم مطابقة NCE + تقييم خارجي EQA + امتثال (`nonconform/`, `eqa/`, `compliance/`) | وحدة الجودة في ops (ops-quality.tsx) — نطاق أضيق | جزئي |
| 14 | تخزين/تبريد/شحن (`storage/`, `coldStorage/`, `shipment/`) | عينات: لا تتبع تخزين مبرّد (درجة حرارة لحظية فقط عند الاستلام `lab.ts:73-80`) | فجوة منخفضة |
| 15 | تبادل FHIR وطلبات إلكترونية (`org/openelisglobal/{fhir,dataexchange}/`) | واجهة FHIR قراءة في BMC (`fhir.ts`) | مكافئ تقريبًا |

## الفجوات ذات الأولوية

1. **عالية — واجهة محللة ثنائية الاتجاه**: OpenELIS يُنزّل الطلبات إلى الجهاز (host-query) ويستقبل النتائج عبر `analyzerimport/analyzerreaders` مع إقران جسر BridgePairing؛ BMC يدفع قيمة واحدة عبر HTTP داخلي. أي ربط جهاز حقيقي (Sysmex/Mindray) يتطلب: استقبال ASTM/HL7 على منفذ، مطابقة specimen↔order، وضع نتائج في قائمة انتظار التحقق (وليس إدخالها مباشرة).
2. **متوسطة-عالية — سلسلة الكاشف ↔ الاختبار ↔ QC**: مخزون BMC (lotNo/expiry/FEFO) يعيش بمعزل عن `labTest` و`qcRun`؛ عند فشل QC لا يستطيع النظام حظر استخدام دفعة كاشف بعينها (OpenELIS: UpdateQCStatusModal + testreagentlink).
3. **متوسطة — Westgard متعدد القواعد**: تقييم BMC نقطي (نسبة من الهدف)؛ قواعد مثل R-4s (انتشار بين مستويين) و4-1s و10-x تحتاج متوسط نقاط متعددة — منطق `lib/algorithms.ts` قابل للتوسعة دون تغيير مخطط (قاعدة نصية في qcRun.rule موجودة أصلًا).
4. **متوسطة — الاختبارات الانعكاسية**: تفعيل اختبار تالٍ تلقائيًا عند نتيجة حدّية (TSH عالي → Free T4) — متطلب شائع للفحوصات الدرقية لدى طبيب عام.
5. **منخفضة — workplans بالقسم**: تصفية قائمة السحب/النتائج حسب قسم الاختبار (كيمياء/أمراض دم) عندما يتوسع الكتالوج.
6. **منخفضة — توثيق مكالمة القيمة الحرجة**: OpenELIS يسجّل من اتُّصل به ومتى ومَن أخطر؛ BMC يسجّل الإقرار داخل التطبيق فقط — إضافة حقلين (phone/who-notified) في نموذج ack-critical.

## ملخص الفجوات بدرجات الخطورة

| الفجوة | الخطورة | الأثر التشغيلي |
|---|---|---|
| واجهة محللة ثنائية الاتجاه | عالية | لا يمكن ربط جهاز محلل حقيقي (Sysmex/Mindray) — دفع أحادي فقط |
| ربط كاشف ↔ اختبار ↔ QC | متوسطة-عالية | فشل QC لا يحظر دفعة كاشف — خطر نتيجة خاطئة |
| Westgard متعدد القواعد (R-4s/4-1s/10-x) | متوسطة | كشف انزياحات مبكرة أضعف من LIS مرجعي |
| اختبارات انعكاسية Reflex | متوسطة | فحوصات تابعة يدوية (TSH عالٍ ← Free T4) |
| توثيق مكالمة القيمة الحرجة | منخفضة | حلقة CLSI غير مكتملة (لدينا الإقرار داخل التطبيق فقط) |
| workplans بالقسم/اللوحة | منخفضة | تصفية أوسع عند نمو الكتالوج |
| ميكروبيولوجيا/أنسجة/EQA | منخفضة (خارج المواصفة) | توثيق كخارطة طريق |

## أدلة الملفات (Paths Evidence)

- `reference-systems/openelis/frontend/src/components/` — 55 مكونًا (workplan, validation, qc, inventory, analyzers, resultPage, microbiology, pathology, cytology, eOrder, nonconform, eqa, coldStorage, esignature...).
- `reference-systems/openelis/src/main/java/org/openelisglobal/qc/service/evaluator/` — 11 مقيّم Westgard (AbstractWestgardRuleEvaluator, Rule1_3s, Rule2_2s, RuleR_4s, Rule4_1s, Rule7_t, Rule10_x...).
- `reference-systems/openelis/frontend/src/components/inventory/` — LotDetailsPanel, DisposeLotModal, ReorderSuggestionsModal, **UpdateQCStatusModal**, gs1.js (باركود GS1).
- `reference-systems/openelis/frontend/src/components/analyzers/` — AnalyzerSetup, AnalyzerTypeMapping, **BridgePairing**, analyzerErrors.
- `reference-systems/openelis/src/main/java/org/openelisglobal/` — 167 حزمة: analyzerimport, analyzerresults, testreagentlink, testreflex, testcalculated, testalertrule, testcodes (LOINC), dataexchange/fhir, validation, workplan.
- `reference-systems/openelis/src/test/resources/testdata/hl7/sysmex-xn-result.hl7` — عينة رسالة جهاز حقيقي.
- المقابل في BMC: `src/server/staff/lab.ts` (230 سطرًا: phleb/worklist → draw → receive → result → verify → ack-critical → analyzer-push → qc)، `src/lib/algorithms.ts` (autoVerifyDecision/deltaCheck/flagFor/refRangeFor)، `src/components/portals/staff/lab-*.tsx` (شاشات 7)، `src/components/portals/staff/ops-inventory.tsx` (lot/expiry/FEFO).

## التوصيات

- **R1 (الأثر/الجهد الأعلى)**: مد `POST lab/analyzer-push` إلى مسار استقبال عام `POST lab/analyzer-import` يقبل ORU كامل ويوزّع OBX على orderItems — يحوّل المحاكي إلى جسر قابل للربط بجهاز فعلي عبر أي HTTP-to-serial gateway.
- **R2**: ربط نموذج مخزون بسيط: حقل اختياري `lotNo` في `qcRun` + تحذير عند دخول نتائج اختبار مرتبط بدفعة "فاشلة QC" (الجدول `InventoryLot` موجود بالفعل).
- **R3**: إضافة مقيم Westgard ثانٍ (R-4s و2-2s عبر نقطتين أخيرتين) في `src/lib/algorithms.ts` مع الحفاظ على توقيع الدالة الحالي.
- **R4**: حقلا "أُبلغ بالهاتف: نعم/لا + من" في `ack-critical` لإغلاق حلقة CLSI.
- **R5**: تأجيل الميكروبيولوجيا/الأنسجة خارج نطاق المواصفة مع توثيق ذلك هنا كمرجع مستقبلي.
