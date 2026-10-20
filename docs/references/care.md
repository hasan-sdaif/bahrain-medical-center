# مرجع: Care (ohcnetwork) — دراسة مقارنة وتحليل فجوات (R3)

> النظام: Care — منصة OHC الهندية؛ النسخة المستنسخة هي **الخلفية Django بعد إعادة كتابتها بموارد متوافقة FHIR** (الواجهة care-fe مستودع منفصل غير مستنسخ).
> المسار المحلي: `reference-systems/care` (`care/emr/` — 43 نموذجًا + 52 واجهة API، `care/facility/`, `care/users/`, `care/audit_log/`).

## نظرة عامة

قيمة Care لنا ليست في الوظائف السريرية (BMC يغطيها) بل في **قرارات معمارية**: (1) كل شيء مورد FHIR-محاذاة (Encounter/Observation/Condition/...) مع امتدادات JSON، (2) تعدد مستأجرين بتراتبية منظمات (geo organization ← facility ← organization داخلية)، (3) الاستبيانات المنظمة كمحرك عام (Questionnaire → FormSubmission → structured_responses JSON)، (4) نظام مواعيد بالرموز (TokenQueue/Slot)، و(5) MFA/OTP في صلب المستخدمين. إدارة الأصول التي اشتهر بها Care تظهر هنا كجداول تاريخية في ترحيلات `facility` (0372_assetavailabilityrecord, 0466_camera_presets) بينما نُقلت الواجهة إلى care-fe — أي أن ميزة "الأصول" عندنا في BMC (ops CMMS) تُقارن عمليًا مع نظام أقدم من المستودع نفسه.

## جرد القدرات (القدرة | مقابلها في BMC | الحالة)

| # | القدرة في Care (الدليل) | مقابلها في BMC | الحالة |
|---|---|---|---|
| 1 | Encounter غني: status_history JSON, period, hospitalization, priority, care_team + كاش مستخدمين, current_location (سرير), tags, extensions (`care/emr/models/encounter.py:8-63`) | `encounter` بـ code/status/type/chief/assessment/department (`fhir.ts:47-63` يكشفها) | جزئي — BMC أخف |
| 2 | سجلات منظمة: Questionnaire/FormSubmission/QuestionnaireResponse مع structured_responses (`care/emr/models/questionnaire.py:10-96`; واجهات: `emr/api/viewsets/{questionnaire,form_submission,questionnaire_response}.py` + قوالب response) | لا محرك استبيانات عام — موافقات مُصمّرة (emr-consents) + قوالب تقارير أشعة فقط | **فجوة متوسطة** |
| 3 | تعدد مستأجرين: geo-organization + Facility + FacilityOrganization + FacilityFeature (`care/facility/models/facility.py:153-205`, `care/emr/models/organization.py`) | مركز واحد بأقسام + مناطق محافظات للسحب المنزلي (single-tenant بالممواصفة) | مقصود — لا فجوة حاليًا، نمط للتوسع متعدد الفروع |
| 4 | مواعيد بالرموز: TokenQueue/TokenSubQueue/TokenCategory/Token + TokenSlot/TokenBooking (`care/emr/models/scheduling/{token,booking}.py`) | مواعيد بفترات صباحية/مسائية + كشف طابور + kiosk + شاشة عرض queue (`patient/book-dialog.tsx`, `portals/queue/`, `portals/kiosk/`) | مكافئ وأغنى تشغيليًا (باركود+عرض عمومي) |
| 5 | مصادقة: MFA (mfa_login), TOTP, OTP + إدارة مهارات Skill/UserSkill (`care/users/models.py:74-96`, `care/emr/api/viewsets/{mfa_login,totp}.py`, `tasks/cleanup_expired_otps.py`) | ترويسة demo + مصفوفة أدوار (perm.ts) | فجوة منخفضة (مقصودة للعرض) |
| 6 | تدقيق شامل كـ middleware تلقائي (`care/audit_log/middleware.py` + receivers) | audit() يدوي في كل مسار + شاشة admin-audit | مكافئ (نمطنا صريح أكثر، نمطهم أضمن ضد النسيان) |
| 7 | مخزون وسلاسل توريد: inventory_item, supply_request/supply_delivery, product/product_knowledge (`care/emr/models/{inventory_item,product,supply_*}.py`) | ops-inventory (lot/expiry/FEFO/par) + صيدلية (`staff/pharmacy.ts`) | مكافئ تقريبًا |
| 8 | أصول ومرافق (تاريخيًا في هذه النسخة؛ ترحيلات 0372/0466 أعلاه؛ README: "Realtime Analytics of Beds, ICUs, Ventilators, Oxygen") | **ops-assets CMMS**: أصل بباركود، بلاغ أعطال بالمسح، أوامر عمل + دردشة فنيين + قطع + SLA + downtime (`src/server/staff/ops.ts:99-145`, ops-fault/workorders/wochat) | BMC متقدم بوضوح |
| 9 | تنظيم سريري شامل: 43 نموذجًا — observation, condition, allergy_intolerance, medication_request/dispense/administration/statement, diagnostic_report, service_request, specimen, consent, device, charge_item/invoice, notes (`care/emr/models/`) | EMR: مشكلة/تقييم/طلبات/وصفات/مؤشرات/موافقات/إحالات + حساسية؟ (emr-chart يعرض allergies) | مكافئ في التغطية الشائعة؛ Care أوسع نمذجةً (مثلًا medication administration مقابل صرفنا) |
| 10 | إشعارات | لا يوجد في هذه النسخة الخلفية (انتقلت عبر نظام plugs — `plugs/`, `plug_config.py`) | BMC لديه إشعارات داخلية + تصعيد (متفوق حاليًا) |
| 11 | واجهات: 52 viewset REST مع otp/batch_request/favorites/tagging (`care/emr/api/viewsets/`) | مسارات API مسطحة لكل بوابة (`src/server/*`) | مكافئ بأسلوب مختلف |
| 12 | تنظيم مواقع داخل منشأة: Location/FacilityLocation (`care/emr/models/location.py`) | أقسام + غرف استقبال (room في الطابور) | جزئي |
| 13 | FHIR: تصدير/تحويل (`care/emr/fhir/`) | واجهة FHIR قراءة (fhir.ts) | مكافئ تقريبًا |

## الفجوات ذات الأولوية

1. **متوسطة — محرك استبيانات عام (Structured Questionnaires)**: أنظف إضافة معمارية ممكنة لـ BMC. الحالة الأكثر إقناعًا: **استبيان قبل الزيارة** في الحجز العام + **نموذج فرز تمريض** عند الاستقبال. نمط Care (JSON schema + structured_responses + قوالب استجابة) ينسخ مباشرة إلى جدول `Questionnaire` + `QuestionnaireResponse` واحد عندنا مع Prisma JSON.
2. **متوسطة — Encounter أضعف من نموذج Care**: لا status_history، لا care_team متعدد، لا أولوية، لا ربط موقع/سرير. عند توسع BMC لتنويم قصير أو عيادات متعددة الأطباء ستحتاج هذه الحقول — الآن يمكن تأجيلها بأمان.
3. **منخفضة — multi-branch/geo-tenancy**: نمط FacilityOrganization + geo hierarchy هو المرجع الصحيح إذا تحول BMC إلى سلسلة مراكز (المواصفة الحالية: مركز واحد).
4. **منخفضة — MFA/OTP للمريض والطاقم**: للعرض التجريبي مقبول؛ للإنتاج مطلوب — خارطة طريق فقط.
5. **منخفضة — تدقيق كـ middleware**: نمط Care يضمن عدم نسيان التدقيق في المسارات الجديدة (لدينا اليوم audit() يدوي — خطر انجراف مع تمدد الكود).

## أين يتقدم BMC على المرجع

- أصول/CMMS بأوامر عمل ودردشة فنيين وSLA (Care الخلفية الحالية لا تحوي نماذج أصول فعلًا).
- إشعارات + تصعيد حرجة مجدول (Care نقل الإشعارات خارج النواة).
- فواتير/تأمين (claims/preauth/shifts/Benefit-webhook) مقابل نماذج invoice/charge_item خام.
- بوابة مريض كاملة 11 شاشة + موقع عام + AI إداري (خلفية Care بلا واجهة هنا أصلًا).
- ثنائية اللغة RTL.

## ملخص الفجوات بدرجات الخطورة

| الفجوة | الخطورة | الأثر التشغيلي |
|---|---|---|
| لا محرك استبيانات عام (Questionnaire) | متوسطة | فرز ما قبل الزيارة ونماذج التمريض يدوية/مفقودة |
| Encounter أضعف (لا status_history/care_team/سرير) | متوسطة (مؤجلة) | عائق عند تعدد الأطباء/التنويم |
| multi-branch/geo-tenancy | منخفضة (مقصود) | مركز واحد بالمواصفة — نمط FacilityOrganization للمرجعية |
| MFA/OTP | منخفضة (للإنتاج) | جلسة demo |
| تدقيق كـ middleware تلقائي | منخفضة | خطر نسيان audit() في المسارات الجديدة |

## أدلة الملفات (Paths Evidence)

- `reference-systems/care/care/emr/models/` — 43 نموذجًا (encounter.py, questionnaire.py, observation.py, condition.py, allergy_intolerance.py, medication_*.py, specimen*.py, supply_*.py, invoice.py, charge_item.py, scheduling/{token,booking}.py, location.py, organization.py...).
- `reference-systems/care/care/emr/api/viewsets/` — 52 واجهة (encounter, questionnaire, form_submission, questionnaire_response, scheduling/, mfa_login, totp, inventory/, batch_request...).
- `reference-systems/care/care/emr/models/questionnaire.py` (سطور 10-96) — Questionnaire → FormSubmission → QuestionnaireResponse مع structured_responses JSON + قوالب استجابة (QuestionnaireResponseTemplate).
- `reference-systems/care/care/emr/models/encounter.py` (سطور 8-63) — status_history, period, hospitalization, priority, care_team + care_team_users cache, current_location, tags, extensions + كاش تنظيمي EncounterOrganization.
- `reference-systems/care/care/facility/models/facility.py:153-205` — Facility + geo_organization + FacilityFeature؛ ترحيلات الأصول التاريخية: `care/facility/migrations/0372_assetavailabilityrecord.py`, `0466_camera_presets.py`.
- `reference-systems/care/care/users/models.py` — Skill/UserSkill, UserFlag, PlugConfig؛ `care/emr/api/viewsets/{mfa_login,totp}.py` — OTP/MFA.
- `reference-systems/care/care/audit_log/` — middleware.py, receivers.py (تدقيق تلقائي شامل).
- المقابل في BMC: `src/server/staff/clinical.ts` + `src/server/staff/ops.ts` (CMMS: maintenance/assets, faults, work orders 99-145)، `src/components/portals/staff/emr-*.tsx` (9 شاشات)، `src/components/portals/staff/lab-radreport.tsx` (القوالب المنظمة الحالية)، `prisma/schema.prisma` (Encounter/Consent بـ JSON).

## التوصيات

- **R1**: تبني نمط الاستبيانات من Care كمحرك عام واحد: جدولان (قالب JSON + استجابة JSON) و3 مسارات API؛ أول تطبيقين: فرز الحجز العام، ونموذج TI-RADS كاستبيان بدل حقول صلبة — يوحّد النمط مع lab-radreport مستقبلًا.
- **R2**: إضافة `statusHistory` و`careTeamIds[]` إلى نموذج encounter (JSON) بجهد مخطط صغير لتجهيز تعدد الأطباء.
- **R3**: توثيق "single-center by design" مع إحالة لنمط FacilityOrganization كمرجع التوسع المستقبلي.
- **R4**: عند دخول الإنتاج، تحويل audit إلى wrapper تلقائي على مستوى الموجّه (router.ts) محاكاةً لـ middleware Care.
