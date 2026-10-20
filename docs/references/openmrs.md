# مرجعية OpenMRS Core (مقارنة مع BMC)

> المصدر: النسخة المحلية `reference-systems/openmrs-core` (الإصدار 3.0.0-SNAPSHOT — وفق `pom.xml`).
> الهدف: جرد قدرات OpenMRS على مستوى النموذج المفاهيمي والخدمات (§2.3 من المواصفة)، ومقارنتها بمعمارية BMC، مع تحديد الفجوات بصراحة.

## نظرة عامة

OpenMRS هو منصة سجلات طبية مفتوحة المصدر مبنية على Java/Spring، وجوهرها (platform) لا يقدم واجهات مستخدم بل **نموذج بيانات مفاهيمي + خدمات REST** تُبنى فوقها وحدات (modules) مثل REST Web Services وFHIR. النقاط المفاهيمية الجوهرية:

- **فصل Person عن Patient**: كل شخص (مريض أو موظف) له سجل `Person` بأسماء وعناوين وسمات، و`Patient` هو تجسيد المريض بمُعرِّفات. الأدلة: `api/src/main/java/org/openmrs/Person.java`، `Patient.java`.
- **قاموس المفاهيم (Concept Dictionary)**: كل ملاحظة طبية أو دواء أو سؤال في نموذج هو `Concept` بمرادفات متعددة اللغات وتصنيفات (`ConceptClass`/`ConceptDatatype`) وتعيينات لقواميس خارجية عبر `ConceptSource`/`ConceptMap`/`ConceptReferenceTerm` (مثل LOINC/ICD/SNOMED). الأدلة: `api/src/main/java/org/openmrs/Concept.java` وحوالي 25 صنفًا مرافقًا في نفس الحزمة.
- **Encounter كوحدة توثيق** و**Visit كمُجمِّع زمني لل encounters** («حاوية» لقاءات المريض خلال فترة متصلة — تعليق الصنف: "can function as a grouper for encounters"). الأدلة: `api/src/main/java/org/openmrs/Visit.java` (علاقة `encounters` مرتبة تنازليًا).
- **Obs كملاحظة ذرية** قابلة للتجميع الهرمي (obs أب/ابن) مع نطاقات مرجعية لكل ملاحظة (`ObsReferenceRange`). الأدلة: `api/src/main/java/org/openmrs/Obs.java`.
- **نظام أوامر موحّد** (`Order` أب + `DrugOrder`/`TestOrder`/`ServiceOrder`/`ReferralOrder` أبناء) مع `OrderGroup` للتجميع و`OrderSet`/`OrderSetMember` كلوائح أوامر جاهزة (Panels)، و`CareSetting` (عيادات/داخلي/طوارئ)، ودورة حياة كاملة (تفعيل/إيقاف/تعديل بأمر جديد مرتبط بالسابق `previousOrder`/انتهاء تلقائي `autoExpireDate`). الأدلة: `api/src/main/java/org/openmrs/Order.java`, `OrderGroup.java`, `OrderSet.java`, `DrugOrder.java`, `TestOrder.java`, `ServiceOrder.java`, `ReferralOrder.java`.
- **البرامج العلاجية**: `Program` → `ProgramWorkflow` → `ProgramWorkflowState`، والتحاق المريض عبر `PatientProgram`/`PatientState`/`transitionToState()`. الأدلة: `api/src/main/java/org/openmrs/PatientProgram.java` (أسطر 203, 290, 381).
- **المجموعات (Cohorts)**: `Cohort`/`CohortMembership` قوائم مرضى ديناميكية للسجلات والتقارير. الأدلة: `api/src/main/java/org/openmrs/Cohort.java` + `CohortService.java`.
- **مزودو الخدمة**: `Provider`/`ProviderRole`/`ProviderAttribute` منفصلون عن حسابات المستخدمين. الأدلة: `api/src/main/java/org/openmrs/Provider.java`.
- **الأشكال (Forms)**: `Form`/`FormField`/`FormResource` + محرر أشكال (Form Builder) مع إصدارات. الأدلة: `api/src/main/java/org/openmrs/Form.java`.
- **RBAC كامل**: `User`/`Role`/`Privilege`. الأدلة: `api/src/main/java/org/openmrs/User.java`.
- خدمات مساندة: `notification` (Alerts/Messages)، `scheduler`، `hl7` (رسائل HL7 v2)، `logic` (محرك قواعد قديم)، وحزمة `api/` تحوي واجهات الخدمات: `PatientService`, `EncounterService`, `VisitService`, `ObsService`, `OrderService`, `ConceptService`, `FormService`, `ProgramWorkflowService`, `CohortService`, `ProviderService`, `ConditionService`, `DiagnosisService`, `MedicationDispenseService` (كلها في `api/src/main/java/org/openmrs/api/`).
- تدقيق عبر Hibernate Envers (`@Audited`) — تدقيق قاعدة بيانات، وليس سلسلة تجزئة.

## جرد القدرات مقابل BMC

| القدرة (OpenMRS) | الدليل من النسخة | مقابلها في BMC | الحالة |
|---|---|---|---|
| MPI: Person/Patient + مُعرِّفات متعددة الأنواع | `Patient.java`, `PatientIdentifier.java`, `PatientIdentifierType.java` | `prisma/schema.prisma`: `Patient` + `PatientIdentifier` (blind index + CPR/جوازات/خليجي) + بحث عربي ضبابي + دمج السجلات `POST patients/merge` (`src/server/staff/core.ts`) | ✔ مُغطى (مع تفوق BMC في البحث العربي والدمج) |
| علاقات الأشخاص (سندات/أوصياء) | `Relationship.java`, `RelationshipType.java` | `PatientRelationship` + `CareTeamMember` | ✔ |
| قاموس مفاهيم مركزي متعدد اللغات + تعيينات LOINC/ICD | `Concept*.java` (25+ صنفًا) | حقول مباشرة: `LabTest.loinc`, `Problem.icd10`, قوائم أدوية/فحوصات مُدمجة | ◐ جزئي (لا توجد إدارة مصطلحات أو إصدارات) |
| Encounter + أنواع وأدوار مزودين | `Encounter.java`, `EncounterType.java`, `EncounterRole.java` | `Encounter` (SOAP + دورة حالة + توقيع + إضافة addendum) في `schema.prisma` و`src/server/staff/clinical.ts` | ✔ |
| **Visit كمُجمِّع لعدة Encounters** | `Visit.java` + `VisitService.java` | لا يوجد كيان زيارة؛ `Encounter` يحمل دورة الحياة كاملة (triage→closed) في صف واحد | ◐ جزئي (كافٍ للعيادات الخارجية؛ يضعف تجميع زيارة تمتد لعدة توثيقات/أيام) |
| Obs ذرية هرمية + نطاقات مرجعية لكل ملاحظة | `Obs.java`, `ObsReferenceRange.java` | `Vitals`, `LabResult` (refRange Json على `LabTest`), `soap` Json | ◐ (منظّم وثابت البنية بدل الهرمية الحرة) |
| أوامر موحدة + دورة حياة (تعديل/إيقاف/انتهاء) | `Order.java` (`previousOrder`, `autoExpireDate`), `CareSetting.java` | `Order`/`OrderItem` (lab\|imaging\|procedure\|nutrition) + حالة draft→reported + CPOE في `clinical.ts` | ◐ (لا revise مرتبط بالأمر السابق ولا auto-expire) |
| OrderSet / لوائح أوامر جاهزة (Panels) | `OrderSet.java`, `OrderSetMember.java`, `OrderGroup.java` | `Package`/`PatientPackage` (تعاقدي) + كتالوج فحوصات؛ لا قوالب CPOE | ◐ |
| **البرامج العلاجية + انتقالات الحالات** | `PatientProgram.java` (transitionToState سطر 203), `ProgramWorkflow*.java` | `Pathway`/`PathwayInstance` موجودة في `schema.prisma` (أسطر 1055–1071) لكن **لا API ولا واجهة** — تُزرع بيانات فقط (`prisma/seed-part2.ts:671`) | ◐ نموذج بلا تشغيل |
| **Cohorts (سجلات المرضى/المجموعات)** | `Cohort.java`, `CohortMembership.java`, `CohortService.java` | لا يوجد مكافئ (تقارير `GET reports/overview` ثابتة فقط) | ✖ مفقود |
| حساسيات بمفاعيل وشدّة | `Allergy.java`, `Allergies.java`, `AllergyReaction.java`, `Allergen.java` | `Allergy` (نموذج) + فحص تفاعلات/حساسية في `src/lib/algorithms.ts` (Rx safety) | ✔ |
| مشكلات/تشخيصات بحالة تحقق | `Condition.java`, `Diagnosis.java`, `ConditionVerificationStatus.java` | `Problem` (icd10 + active/resolved) | ✔ |
| صرف الدواء (MedicationDispense) | `MedicationDispense.java`, `MedicationDispenseService.java` | `Dispensing` (FEFO) + `pharmacy/dispense` في `src/server/staff/pharmacy.ts` | ✔ |
| مزودو الخدمة وأدوارهم | `Provider.java`, `ProviderRole.java`, `ProviderAttribute.java` | `Employee` (بأدوار سريرية) + `CareTeamMember` | ◐ (لا مزودين خارجيين/إحالة عكسية) |
| **مُنشئ الأشكال (Form Builder) + إصدارات النماذج** | `Form.java`, `FormField.java`, `FormResource.java` | نماذج ثابتة مبرمجة (EMR بعشرين تبويبًا، قوالب موافقات 19) | ✖ (خيار تصميمي — أي حقل جديد يتطلب كودًا) |
| سمات مخصصة قابلة للتوسيع | `PersonAttributeType.java`, `PatientProgramAttribute.java`, `LocationAttribute.java`... | حقول ثابتة + `Setting`/`FeatureFlag` | ✖ |
| هرمية مواقع (Location/Tags) | `Location.java`, `LocationTag.java` | `Branch` + `ServicePoint` + `BinLocation` (مستودع) | ◐ |
| صلاحيات RBAC | `User.java`, `Role.java`, `Privilege.java` | `src/server/perm.ts` (مصفوفة §5.3) + guard على كل مسار | ✔ |
| تنبيهات ورسائل داخلية | `notification/Alert.java`, `Message.java` | `Notification` + `MessageThread`/`Message` + inbox | ✔ |
| مجدول مهام | `scheduler/` | `src/server/scheduler.ts` (تصعيد 10/20 د، تذكيرات، صيانة وقائية، إيقاف تراخيص) | ✔ |
| **HL7 v2** (ربط أجهزة/أنظمة مستشفيات) | `api/src/main/java/org/openmrs/hl7/` | لا يوجد؛ `lab/analyzer-push` مباشر + جسر FHIR (`src/server/fhir.ts`) | ◐ (بديل عملي لكن كثير من المحللات تتحدث ASTMs/HL7v2) |
| **REST API كتابة كاملة + وحدات OSGi** | بنية `api/` + `webapp/` (وحدة REST خارج هذه النسخة) | BMC: API داخلي كامل + FHIR **قراءة فقط** (9 موارد في `src/server/fhir.ts`) | ◐ (لا FHIR write/create) |
| تدقيق | Envers `@Audited` (سجل قاعدة بيانات) | `AuditEvent` سلسلة تجزئة append-only + `BreakGlass` | ✔ (أقوى من OpenMRS) |
| محرك قواعد منطقية | `logic/LogicService.java`, `Rule.java` | خوارزميات مبرمجة §17 (`src/lib/algorithms.ts`) | ✔ (نهج مبرمج مقصود) |

## الفجوات ذات الأولوية

1. **عالية — Cohorts/سجلات المرضى**: لا يوجد أي مكافئ لـ`CohortService` (`api/src/main/java/org/openmrs/api/CohortService.java`). يؤثر على: سجل الأمراض المزمنة (سكري/ضغط)، قوائم الاستدعاء (recalls)، وتقارير الجودة. البديل الحالي الوحيد: تقارير مجمّدة في `ops-reports.tsx`.
2. **عالية — تشغيل البرامج العلاجية**: نموذج `Pathway` موجود بلا خدمات (لا مسارات في `src/server/staff/clinical.ts` ولا تبويب UI). OpenMRS يوفر انتقالات حالات موثقة زمنيًا (`PatientProgram.transitionToState()`) — مطلوب لعلاج الأورام (دورات كيماوي) والصحة النفسية.
3. **متوسطة — كيان Visit**: BMC يدمج الزيارة في `Encounter` واحد بحالة ممتدة؛ كافٍ للعيادات لكنه يمنع: تجميع (triage + استشارة + متابعة) كتوثيقات منفصلة داخل زيارة واحدة، وتقارير "زيارات" مقابل "توثيقات". FHIR عندنا يصدر Encounter واحدًا لكل سجل.
4. **متوسطة — FHIR كتابة + HL7v2**: `src/server/fhir.ts` يوفر GET فقط؛ لا POST/PUT لـ Patient أو ServiceRequest من أنظمة شريكة، ولا استقبال ASTMs/HL7 من المحللات (الحالي: `POST lab/analyzer-push` مخصص).
5. **متوسطة — إدارة مصطلحات**: `LabTest.loinc`/`Problem.icd10` حقول نصية بلا مصادر ومخططات تعيين مثل `ConceptSource`/`ConceptMap`؛ أي تغيير ترميز يتطلب تعديل قاعدة البيانات يدويًا.
6. **منخفضة — OrderSet قوالب أوامر، revise/auto-expire، ProviderRole، سمات قابلة للتوسيع، Form Builder**: مقبولة كخيارات تصميم لمنظومة أحادية النطاق، لكنها تحدّ التوسع لأقسام/نماذج جديدة دون كود.

## التوصيات

1. إضافة نموذج `Cohort` + `CohortMember` (تعريف بقاعدة: عمري/تشخيصي/مزمن) وخدمة `GET cohorts/:id/members` وربطها بالاستدعاءات الحالية في المجدول — جهد صغير (Prisma + مسار واحد) وقيمة تشغيلية عالية.
2. إحياء `PathwayInstance`: خدمة `POST pathways/enroll` + `POST pathways/transition` + تبويب في EMR يعرض الحالة الحالية والتاريخ — تستفيد من النموذج الموجود أصلاً في `prisma/schema.prisma:1055-1071`.
3. إضافة POST/PUT لموردي FHIR الأكثر أهمية (`ServiceRequest`, `Observation`, `Patient`) في `src/server/fhir.ts` عبر نفس perm-guard، لفتح التكامل مع شركاء التأمين/المختبرات.
4. إدخال `Visit` اختياري كمُجمِّع فوق Encounters (زيارة=يوم خدمة) مع إبقاء التوافق الرجعي؛ يُحسّن تقارير الإيرادات لكل زيارة.
5. ترك الفجوات منخفضة الأولوية (Form Builder، السمات الحرة، OSGi) كما هي — فهي مقايضات مقصودة لصالح صرامة النموذج وسرعة التطوير، وموثقة هنا كقرار معماري.
