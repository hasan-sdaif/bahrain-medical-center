# مرجع: Medplum — دراسة مقارنة وتحليل فجوات (R3)

> النظام: Medplum (خادم FHIR مفتوح المصدر بلغة TypeScript + مكتبة مكوّنات React + منصة سحابية).
> المسار المحلي: `reference-systems/medplum` (نسخة دراسية، gitignored).
> تاريخ الفحص: فحص قدرة-بقدرة مقابل كود BMC الحيّ. مكتبة React: 129 مجلدًا تحت `packages/react/src/` (~122 مكوّن عرض/إدخال FHIR + auth/ + chat/ + buttons/).

## نظرة عامة

Medplum ليس نظامًا طبيًا واحدًا بل **منصة بناء** أنظمة صحية: خادم FHIR R4 كامل (قراءة/كتابة/بحث/معاملات)، طبقة مصادقة OAuth2/OpenID، سياسات وصول دقيقة (AccessPolicy)، اشتراكات (Subscriptions) لوسيكت WebSocket وrest-hook، محرّك أتمتة (Bots)، ومكتبة React من **129 مجلدًا (~122 مكوّنًا)** مُخصّص لعرض/تحرير موارد FHIR. البنية: `packages/` تحتوي 35+ حزمة (server, core, react, react-hooks, fhir-router, hl7, ccda, agent, bot-layer, dosespot-*, health-gorilla-*...). يُعد التطبيق المرجعي Foo Medical (من أنظمتنا الخمسة) مثالًا مبنيًا فوقه (`examples/foomedical`).

## جرد القدرات (القدرة | مقابلها في BMC | الحالة)

| # | القدرة في Medplum (الدليل) | مقابلها في BMC | الحالة |
|---|---|---|---|
| 1 | خادم FHIR R4 كامل CRUD + بحث متقدم (`packages/server/src/fhir/repo.ts`, `search.ts`, `routes.ts`) | واجهة FHIR للقراءة فقط: 9 أنواع موارد، بحث بـ `?patient=` و`?_id=` فقط (`src/server/fhir.ts:203-259`) | جزئي — قراءة فقط |
| 2 | مصادقة OAuth2/OIDC: دخول، MFA/TOTP، Google، مزوّد خارجي، تسجيل، استعادة كلمة مرور، إبطال جلسات (`packages/server/src/auth/` — 28 ملفًا: `login.ts`, `mfa.ts`, `google.ts`, `exchange.ts`, `register.ts`, `revoke.ts`) | جلسة تجريبية عبر ترويسة `x-bmc-actor` + مصفوفة أدوار (`src/server/perm.ts`) | فجوة (مقصودة للعرض التجريبي) |
| 3 | AccessPolicy: سياسة لكل مورد + حجيرات Compartment + قواعد IP (`packages/server/src/fhir/accesspolicy.ts`) | RBAC مصفوفة دور→وحدة (perm.ts) + حجب مريض-نطاق في بوابات المرضى | جزئي — أخشن حبيبية |
| 4 | اشتراكات FHIR: WebSocket + rest-hook عبر طوابير BullMQ (`packages/server/src/workers/subscription.ts`, `ws/subscriptions.ts`) | وقت-حقيقي socket.io (mini-services/realtime منفذ 3003) + إشعارات داخل التطبيق + مجدول تصعيد (`src/server/scheduler.ts`) | مكافئ وظيفيًا بنموذج مختلف |
| 5 | مكتبة React: مدخلات/عارضات لكل نوع بيانات FHIR (HumanName, CodeableConcept, Quantity, Identifier, Attachment...), SearchControl مع محرر فلاتر، ResourceTable/Board/Form/History/Diff/Blame، Scheduler، QuestionnaireBuilder/Form، ThreadInbox/Chat (`packages/react/src/` — 129 مجلدًا منها ~122 مكوّنًا) | مكوّنات shadcn/ui مبنية يدويًا + جداول مخصصة لكل شاشة (`src/components/portals/*`) | فجوة أنماط — قابل للاستلهام |
| 6 | React-hooks: useSearch, useResource, useSubscription, useMedicationCart, useThreadInbox, useWhisper (`packages/react-hooks/src/`) | hooks محلية useFetch/useLab لكل بوابة | مكافئ مبسط |
| 7 | عمليات FHIR: `$everything`, `$export`, `$find/$book/$hold` (جدولة بمسك مؤقت), `$match` (إزالة تكرار المرضى), `$summary`, `claimsubmit`, `coverageeligibilityrequestsubmit`, `smarthealthlinks` (`packages/server/src/fhir/operations/` — 80+ عملية) | لا عمليات FHIR؛ الحجز عبر API خاص (public.ts)؛ إزالة التكرار يدويًا ببحث الاستقبال (reception-search dupwarn) | فجوة |
| 8 | Bots: دوال serverless تُطلق على الأحداث (`packages/server/src/bots/`, `bot-layer`) | لا مكافئ مباشر؛ مجدول تصعيد داخلي (scheduler.ts) يلعب دورًا مشابهًا | فجوة منخفضة |
| 9 | تكاملات: HL7 v2 (`packages/hl7`), C-CDA (`packages/ccda`), DICOM (`server/src/dicom`), FHIRCast مزامنة سياق (`server/src/fhircast/routes.ts`), SCIM | محاكي HL7 ORU^R01 فقط (`src/server/staff/lab.ts:149-163`)؛ واجهة FHIR قراءة | فجوة عالية |
| 10 | SMART on FHIR: SmartAppLaunchLink (`packages/react/src/SmartAppLaunchLink`) | غير موجود | فجوة (مستقبلية) |
| 11 | AI: `packages/server/src/ai/openai.ts` + طبقة agent | مساعد إداري z-ai-web-dev-sdk بنطاق إداري صارم (`src/server/ai.ts`) | مكافئ (BMC مقيد بوعي — لا PHI) |
| 12 | وكلاء أجهزة Agent لجسر المختبرات/الأجهزة المحلية (`packages/agent`) | محاكي analyzer-push فقط | فجوة عالية (مشتركة مع OpenELIS) |
| 13 | تصدير جماعي Bulk Data (`fhir/bulkdata.ts`), حدود معدل (`ratelimit.ts`), تدقيق AuditEvent (`repo-auditevent.ts`) | سجل تدقيق شامل audit() في كل مسار + بوابة admin-audit | جزئي — لا تصدير جماعي |

## الفجوات ذات الأولوية

1. **عالية — واجهة FHIR للقراءة فقط**: طموح المواصفة (§6.7 "التكامل عبر FHIR") محدود بلا كتابة/معاملات/بحث كامل. أي جسر تشغيلي مع أنظمة خارجية (تأمين، مختبر مرجعي) سيصطدم. الدليل: `src/server/fhir.ts` (CAPABILITY: interaction = read/search-type فقط).
2. **عالية — لا مصادقة حقيقية (OAuth2/MFA)**: مخصص للعرض لكنه يحرم BMC من أنماط جلسة المريض الحقيقية التي يجيدها Medplum (`packages/react/src/auth/`: SignInForm, MfaForm, RegisterForm...).
3. **متوسطة — غياب مكوّنات FHIR-WARE في الواجهة**: SearchControl (فلاتر/فرز/تصدير بحث)، ResourceTable (أعمدة قابلة للتهيئة)، PatientHeader/PatientSummary، QuestionnaireForm — أنماط ناضجة يمكن استنساخ فكرتها في shadcn بدل بناء كل جدول يدويًا.
4. **متوسطة — لا `$match` لتطابق المرضى**: Medplum يحل التكرار الزائف خوارزميًا؛ BMC يعتمد على تنبيه الاستقبال اليدوي.
5. **منخفضة — Bots/FHIRCast/SMART**: نضج مبكر عند BMC غير مطلوب حاليًا للمواصفة.

## ملخص الفجوات بدرجات الخطورة

| الفجوة | الخطورة | الأثر التشغيلي |
|---|---|---|
| واجهة FHIR للقراءة فقط | عالية | يمنع أي تكامل كتابة مع أنظمة خارجية (تأمين/مختبر مرجعي) |
| لا OAuth2/MFA | عالية (للإنتاج) | جلسات demo غير قابلة للتشغيل الحقيقي |
| غياب مكوّنات FHIR-WARE (SearchControl/ResourceTable) | متوسطة | إنتاجية شاشات البحث والجداول للأطباء |
| لا `$match` (تطابق مرضى خوارزمي) | متوسطة | الاعتماد على تنبيه الاستقبال اليدوي |
| لا Bots/FHIRCast/SMART | منخفضة | خارطة طريق توافقية |

## أدلة الملفات (Paths Evidence)

- `reference-systems/medplum/packages/` — 35+ حزمة (server, core, react, react-hooks, fhir-router, hl7, ccda, agent, bot-layer, dosespot-*, health-gorilla-*).
- `reference-systems/medplum/packages/react/src/` — 129 مجلدًا (~122 مكوّن عرض/إدخال، من AddressDisplay إلى ValueSetAutocomplete) + `auth/` (28 نموذج مصادقة) + `chat/` (ThreadInbox/BaseChat) + `buttons/`.
- `reference-systems/medplum/packages/server/src/auth/` — login.ts, mfa.ts, google.ts, exchange.ts, register.ts, revoke.ts (OAuth2/OIDC كامل).
- `reference-systems/medplum/packages/server/src/fhir/accesspolicy.ts` — سياسات RBAC + Compartment + قواعد IP.
- `reference-systems/medplum/packages/server/src/workers/subscription.ts` + `ws/subscriptions.ts` — اشتراكات WebSocket/rest-hook عبر BullMQ.
- `reference-systems/medplum/packages/server/src/fhir/operations/` — 80+ عملية FHIR ($everything, $find/$book/$hold, $match, claimsubmit, smarthealthlinks...).
- `reference-systems/medplum/packages/server/src/fhircast/routes.ts` — مزامنة سياق المستخدم بين التطبيقات.
- `reference-systems/medplum/packages/react-hooks/src/` — 24 hook جاهز (useSearch, useSubscription, useThreadInbox, useMedicationCart...).
- المقابل في BMC: `src/server/fhir.ts` (262 سطرًا، 9 موارد، قراءة فقط)، `src/server/perm.ts` (مصفوفة RBAC)، `src/server/ai.ts` (مساعد إداري) ، `src/server/scheduler.ts` (تصعيد حرجة).

## التوصيات

- **R1**: ترقية `fhir.ts` إلى كتابة موقّعة (write عبر جلسة staff) لثلاثة موارد فقط يستهلكها الجسر فعليًا: ServiceRequest (استقبال طلبات خارجية), DiagnosticReport (نتائج مختبر مرجعي), Patient (upsert بمعرف MRN) — دون بناء خادم كامل.
- **R2**: استلهام أنماط `SearchControl`/`ResourceTable` في شاشات EMR الكبيرة (عمود قابل للاخفاء + فلتر محفوظ + تصدير CSV) — أثر مباشر على إنتاجية الأطباء.
- **R3**: توثيق قرار معماري صريح: "جلسة تجريبية مقصودة" في docs/API.md حتى لا يُحسب غياب OAuth2 فجوة إهمال.
- **R4**: عند دخول مرحلة إنتاج: اعتماد Medplum كخادم FHIR جانبي (وضع fhir-router) بدل توسيع الواجهة اليدوية — يوفر اشتراكات وتدقيقًا جاهزين.
