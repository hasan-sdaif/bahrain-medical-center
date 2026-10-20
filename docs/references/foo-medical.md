# مرجع: Foo Medical — دراسة مقارنة وتحليل فجوات (R3)

> النظام: Foo Medical — بوابة مريض مرجعية مبنية على Medplum (تسجيل ذاتي، نتائج، رسائل آمنة، حجز، فواتير).
> المسار المحلي: `reference-systems/foo-medical` (تطبيق Vite + React + Mantine فوق @medplum/react).
> ملاحظة: هو نفسه `medplum/examples/foomedical` — أي أن دراسته تغطي "النموذج المرجعي" لبنية بوابة المريض.

## نظرة عامة

تطبيق بوابة مريض كامل الوظائف (11 صفحة + 15 مسارًا فرعيًا) بُني ليعرض أفضل ممارسات Medplum للواجهة المريضية. كل شيء FHIR-أصيل: الرسائل = `Communication`، النتائج = `DiagnosticReport/Observation`، الحجز = `Appointment/Slot` عبر عملية `$find`، الفواتير = `Coverage/PaymentNotice`. المصدر الكامل للمسارات: `src/Router.tsx` (سطور 33-72).

## جرد القدرات (القدرة | مقابلها في BMC | الحالة)

| # | القدرة في Foo Medical (الدليل) | مقابلها في BMC | الحالة |
|---|---|---|---|
| 1 | تسجيل ذاتي للمريض مع Google + reCAPTCHA (`src/pages/RegisterPage.tsx` — RegisterForm) | لا تسجيل ذاتي: دخول تجريبي باختيار سجل (MRN + هاتف مقنّع) (`src/components/portals/patient/login.tsx`)؛ التسجيل الحقيقي في الاستقبال (`reception-register.tsx`) | فجوة (قرار تصميمي للعرض) |
| 2 | رسائل آمنة بخيوط ThreadInbox + بحث (`src/pages/MessagesPage.tsx`) | شاشة الرسائل: سياسة مراسلة آمنة + تنبيه طوارئ 999 + نقاط غير مقروء (`screen-messages.tsx` → `/api/patient/notifications`) | مكافئ وأفضل سياساتيًا |
| 3 | سجل صحي: نتائج مخبرية، أدوية، ردود استبيانات، لقاحات، مؤشرات حيوية (`src/pages/health-record/{LabResults,Medications,Responses,Vaccines,Vitals}.tsx`) | 11 شاشة مريض: نظرة عامة/مواعيد/نتائج/وصفات/فواتير/مستندات/رسائل/عائلة ونمو/سحب منزلي/موافقات/خصوصية (`src/components/portals/patient/screen-*.tsx`) | BMC أوسع؛ **غياب شاشة لقاحات/مؤشرات حيوية للمريض** رغم وجود البيانات (Immunization+Vitals في fhir.ts) |
| 4 | صفحة رصد مفردة Observation بعمق (`src/pages/ObservationPage.tsx`) | شاشة النتائج مع FlagBadge ونطاقات مرجعية (`screen-results.tsx`) | مكافئ |
| 5 | خطة علاج + بنود إجراءات Action Items (`src/pages/care-plan/`) | لا يوجد مكافئ مباشر موجه للمريض (المتابعة عبر المواعيد + المستندات) | فجوة متوسطة |
| 6 | حجز موعد BaseScheduler + عملية `$find` + **مسك مؤقت Hold** (`src/pages/GetCarePage.tsx`) | حجز عام 4 خطوات + حوار حجز المريض (فترة صباحية/مسائية) (`public/sections/booking*.tsx`, `patient/book-dialog.tsx`) | مكافئ بدون دلالة Hold |
| 7 | عضوية وفواتير: عرض Coverage + PaymentNotice (`src/pages/account/MembershipAndBilling.tsx`) | فواتير المريض + دفع عبر بوابة Benifet-محاكاة مع توقيع HMAC وwebhooks (`screen-invoices.tsx`, `src/server/webhooks.ts`) | **BMC متقدم — Foo للعرض فقط** |
| 8 | Smart Health Links: توليد/استيراد SHL (`src/pages/SmartHealthLinksPage.tsx`) | لا يوجد؛ لدينا QR تحقق مستندات (`verify/` + `fhir.ts:199`) | فجوة متوسطة (توافقية متقدمة) |
| 9 | استبيانات: فرز + استقبال مريض (`src/pages/ScreeningQuestionnairePage.tsx`, `PatientIntakeQuestionnairePage.tsx` — QuestionnaireForm) | موافقات بنسخ + قوالب تقارير الأشعة المنظمة (TI-RADS/BI-RADS)؛ لا محرك استبيانات عام | فجوة متوسطة |
| 10 | ملف الحساب: بروفايل + مزوّد رعاية (`src/pages/account/`) | شاشة الخصوصية (حقوق DPO/سحب موافقة) + نظرة عامة المريض | جزئي |
| 11 | ثنائية اللغة/RTL | عربي/إنجليزي RTL/LTR حقيقي في كل الشاشات + i18n مركزي | **BMC متقدم بوضوح** |

## الفجوات ذات الأولوية

1. **متوسطة — شاشة لقاحات ومؤشرات حيوية للمريض**: البيانات موجودة (`Immunization`, `Vitals` — انظر `src/server/fhir.ts:162-174, 65-102`) لكن لا شاشة مريض تعرضها؛ Foo Medical يعرضها كتبويبات. جهد صغير، أثر كبير على اكتمال "السجل الصحي".
2. **متوسطة — غياب محرك استبيانات عام**: فرز ما قبل الزيارة (intake questionnaire) يقلل زمن الاستشارة ويغذي EMR ببيانات منظمة. نمط Medplum QuestionnaireForm قابل للاستنساخ كـ schema-driven form.
3. **متوسطة — Smart Health Links**: المواصفة تطمح للتكامل الإقليمي؛ SHL هو المعيار الفعلي لمشاركة السجل عبر الجهات. يتطلب تواقيع JWS — يمكن تأجيله مع توثيقه كخارطة طريق.
4. **منخفضة — خطة علاج/Action Items للمريض**: تعليمات ما بعد الزيارة كبنود قابلة للتعليم. BMC يعطيها كمستندات PDF/طباعة — مقبول حاليًا.
5. **منخفضة — تسجيل ذاتي**: قرار معماري متعمد (البيانات تُنشأ في الاستقبال/الحجز العام)؛ يكفي توثيقه.

## أين يتقدم BMC على المرجع

- دفع فعلي بمحاكي بوابة Benefit + idempotency + HMAC (Foo يعرض Coverage فقط بلا دفع).
- نمو عائلي WHO (percentile/z-score) — غير موجود في Foo.
- سحب منزلي بمناطق محافظات وتوجيه مسارات.
- تحقق مستندات بـ QR للعموم + تصعيد تنبيهات حرجة 0/10/20 دقيقة.
- ثنائية لغة RTL حقيقية (Foo أحادي اللغة إنجليزي).

## ملخص الفجوات بدرجات الخطورة

| الفجوة | الخطورة | الأثر التشغيلي |
|---|---|---|
| لا شاشة لقاحات/مؤشرات حيوية للمريض | متوسطة | بيانات موجودة (Immunization/Vitals) بلا عرض — إكمال السجل الصحي |
| لا محرك استبيانات (فرز/استقبال) | متوسطة | زمن استشارة أطول وفقدان بيانات منظمة |
| لا Smart Health Links | متوسطة (مؤجلة) | مشاركة سجل عابر للجهات إقليميًا |
| لا خطة علاج/Action Items للمريض | منخفضة | التعليمات كمستندات فقط |
| لا تسجيل ذاتي | منخفضة (مقصود) | القرار: التسجيل في الاستقبال/الحجز العام |

## أدلة الملفات (Paths Evidence)

- `reference-systems/foo-medical/src/Router.tsx` (سطور 33-72) — كل المسارات: Communication, Questionnaire, screening/patient-intake, health-record/* (lab-results, medications, questionnaire-responses, vaccines, vitals), Observation, care-plan/action-items, get-care, smart-health-links, account/*.
- `reference-systems/foo-medical/src/pages/RegisterPage.tsx` — تسجيل ذاتي RegisterForm مع Google + reCAPTCHA.
- `reference-systems/foo-medical/src/pages/GetCarePage.tsx` — BaseScheduler + عملية $find + مسك مؤقت Hold.
- `reference-systems/foo-medical/src/pages/MessagesPage.tsx` — ThreadInbox مع بحث Communication.
- `reference-systems/foo-medical/src/pages/SmartHealthLinksPage.tsx` — توليد/استيراد SHL.
- `reference-systems/foo-medical/src/pages/account/MembershipAndBilling.tsx` — عرض Coverage + PaymentNotice فقط (لا دفع فعلي).
- المقابل في BMC: `src/components/portals/patient/` (11 شاشة screen-*.tsx + book-dialog)، `src/components/portals/public/sections/` (booking*, ai-assistant)، `src/server/webhooks.ts` (دفع Benefit-محاكاة HMAC)، `src/server/patient.ts`.

## التوصيات

- **R1**: إضافة شاشتين في بوابة المريض بجهد يوم: `screen-vaccines.tsx` و`screen-vitals.tsx` من نفس البيانات المصدرة أصلًا في fhir.ts (لا تغيير خادم).
- **R2**: نمذجة "استبيان فرز" واحد (pre-visit screening) كخطوة خامسة في `booking-steps.tsx` قبل التأكيد — يعيد استخدام نمط consents-dialog.
- **R3**: اعتماد نمط Foo في "العمق عند النقر" (list → detail) لشاشة النتائج بدل العرض المسطح.
- **R4**: توثيق SHL كخارطة طريق توافقية في docs/API.md (مؤجل بوعي).
