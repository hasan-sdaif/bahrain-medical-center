# مرجعية Frappe Health + ERPNext (مقارنة مع BMC)

> المصدر: النسخ المحلية `reference-systems/frappe-health` (تطبيق Frappe Healthcare — 139 Doctype في `healthcare/healthcare/doctype/`) و`reference-systems/erpnext` (تطبيق ERPNext — وحدات Accounts/Stock/Buying/Selling/Assets/Projects/Support/Quality وفق `erpnext/modules.txt`).
> ملاحظة صدق: **الرواتب/الموارد البشرية الكاملة غير موجودة في هذه النسخة من ERPNext** (انتقلت لتطبيق منفصل Frappe HR منذ v14 — لا يوجد مجلد `hr` أو `payroll` تحت `erpnext/erpnext/`)، وقد وُثّق ذلك في الجرد أدناه.

## نظرة عامة

- **Frappe Healthcare** = طبقة سريرية مبنية على إطار Frappe (Python + Doctypes JSON مولّدة لواجهات UI/REST تلقائيًا): مواعيد بوحدات خدمة وجرداول ممارسين، استشارات، أوامر مخبرية بملاحظات FHIR-style، إجراءات سريرية تستهلك مخزونً، تمريض وIPD، علاج طبيعي، تأمين بعقود شركات، وبوابة مريض منفصلة (`patient_portal/` تطبيق Vue).
- **ERPNext** = ERP كامل يوفر للطبقة الصحية: فوترة ضريبية ومحاسبة قيد مزدوج (192 Doctype في `erpnext/accounts/doctype/` و62 تقريرًا محاسبيًا في `erpnext/accounts/report/`)، مخزون (81 Doctype في `erpnext/stock/doctype/`)، شراء، عملاء، أصول بإهلاكات، مشاريع/مهام، دعم عملاء بـSLA، وإدارة جودة.
- الوصلتان بينهما: حقل `invoiced`/`ref_sales_invoice` في كل Doctype صحي (مثال: `patient_appointment/patient_appointment.json`)، وربط `healthcare_practitioner.employee` و`patient.customer` بسجلات ERPNext، و`healthcare_service_unit.warehouse` لاستهلاك المخزون أثناء الإجراءات (`clinical_procedure/clinical_procedure.json`: `consume_stock`, `invoice_separately_as_consumables`).

## جرد القدرات مقابل BMC

### (أ) Frappe Healthcare — السريري

| القدرة | الدليل من النسخة | مقابلها في BMC | الحالة |
|---|---|---|---|
| مواعيد بأنواع مرتبطة بخدمات مفوترة + مدد | `appointment_type/` + `appointment_type_service_item/` | `AppointmentType` (مدة/سعر/تغطية تأمين) + `GET appointments/slots` برومضان/زائر | ✔ |
| جداول الممارسين + فتحات زمنية + منع/سماح التداخل + سعة وحدة الخدمة | `practitioner_schedule/`, `healthcare_schedule_time_slot/`, `practitioner_availability/`, `healthcare_service_unit.json` (`overlap_appointments`, `service_unit_capacity`) | فتحات مولّدة برمجيًا في `core.ts` مع أقفال حجز §17؛ `ServicePoint` بسعة عامة | ◐ (لا إدارة سعة لكل نقطة خدمة ولا جدولة مُهيكلة لكل طبيب كـDoctype) |
| طابور بالحضور (check-in) وموضع في الصف | `patient_appointment.json`: `appointment_based_on_check_in`, `position_in_queue` | `checkin` + `QueueTicket` بأوزان أولوية + نداء `queue/call-next` + شاشة عرض | ✔ (أغنى بأوزان الأولوية) |
| استشارة: أعراض/تشخيصات/وصفات مخبر ودواء وإجراء + أوامر تُرسل عند الحفظ | `patient_encounter/patient_encounter.json` (42 حقلًا، `submit_orders_on_save`, `order_group`) | `encounters/soap` + CPOE `orders` + `prescriptions` في `clinical.ts` | ✔ |
| **طلبات خدمة FHIR-style + ملاحظات بقالب (Observation/Service Request)** | `service_request/`, `service_request_category/`, `observation/` (52 حقلًا: عينة، وقت النتيجة، وقت الاعتماد، تفاعل sales_invoice), `observation_template/` | `Order`/`OrderItem`/`LabResult` + `fhir.ts` (ServiceRequest/Observation للقراءة) | ✔ |
| قوالب مخبرية عادية/وصفية/حساسية + مجموعات + وحدات | `normal_test_template/`, `descriptive_test_template/`, `sensitivity_test_template/`, `lab_test_group_template/`, `lab_test_uom/` | `LabTest` (loinc, refRange Json, critical, autoVerify, deltaPct) | ◐ (لا قوالب وصفية/ميكروبية حساسية — BMC مركز عام لا مستشفى مرجعي) |
| **ميكروبيولوجيا: عزلات وحساسيات ومضادات** | `organism/`, `organism_test_item/`, `organism_test_result/`, `sensitivity/`, `antibiotic/` | ✖ | ✖ مفقود |
| جمع العينات بنقاط جمع ومتابعة حالة العينة | `sample_collection/sample_collection.json` (26 حقلًا، `collection_point`) | `Specimen` + `phleb/worklist` + سحب منزلي بالكامل (routing) | ✔ |
| إجراءات سريرية تستهلك مخزونًا وتفوتر المستهلكات منفصلة | `clinical_procedure/clinical_procedure.json` (`consume_stock`, `items`, `consumption_invoiced`) | `Order.kind=procedure` + إصدار مخزون بـ`StockMove(refType)` — بلا فوترة مستهلكات آلية | ◐ |
| **IPD: سجل دخول (54 حقلًا) + إشغال/تحويل أسرّة + ملخص خروج** | `inpatient_record/`, `inpatient_occupancy/`, `inpatient_medication_order/` + `inpatient_medication_entry/` (إعطاء الدواء بسرير المريض), `intake_output_entry/` | لا يوجد — BMC خارجي (عيادات) بحكم التصميم | ✖ (خارج نطاق مركز عيادات؛ يُطلب فقط إن أضيفت رعاية ليلية) |
| تمريض: خطط رعاية وقوائم تحقق ومهام مجدولة | `nursing_care_plan/`, `nursing_checklist_template/`, `nursing_task/` (مهمة فائتة الساعة: `hooks.py` سطر 148) | لا يوجد مكافئ (الممرض: فرز + مؤشرات حيوية + مهام `Task` عامة) | ◐ (Task موجودة بلا قوالب تمريض) |
| **تسليم وردية SBAR** | `shift_handover/shift_handover.json` (situation/background/assessment/recommendation, accepted_by/at) | `Handover` في `schema.prisma:1073` (content Json بـSBAR + readBy) | ✔ |
| علاج طبيعي: خطط وجلسات وقوالب | `therapy_plan/`, `therapy_session/`, `therapy_type/`, `treatment_plan_template/` | ✖ (لا قسم علاج طبيعي ضمن الأقسام العشرة) | ✖ خارج النطاق |
| طوارئ: سجل طوارئ وإشغال | `emergency_record/`, `emergency_occupancy/` | ✖ (لا طوارئ) | ✖ |
| وصفات دوائية FHIR-style مع تكرارات وكميات قابلة للصرف | `medication_request/medication_request.json` (47 حقلًا: intent/priority, `number_of_repeats_allowed`, `total_dispensable_quantity`, `billing_status`) | `Prescription`/`PrescriptionItem` + `Dispensing` FEFO + إعادة تعبئة من البوابة `prescriptions/refill` | ✔ |
| تفاعلات دوائية وتصنيفات ومسوغات تجاوز | `drug_interaction/`, `medication_interaction/`, `medication_class/`, `mediciation_override_reason_code/`, `medication_alert_log/` | فحوص §17 (تفاعل/حساسية/حمل/وزن) في `algorithms.ts` | ✔ (فحوص مبرمجة لا جداول قابلة للتحرير) |
| تذكيرات مواعيد تلقائية + تحديث حالات يومي | `healthcare/hooks.py` (سطور 142–155): `send_appointment_reminder` (all), `update_appointment_status` (daily) | `scheduler.ts`: تذكيرات + تصعيد + إشعارات — ✔ | ✔ |
| **اجتماعات فيديو (Google Meet) ومزامنة تقويم** | `patient_appointment.json` (`add_video_conferencing`, `google_meet_link`), `healthcare_practitioner.json` (`google_calendar`) | نوع `tele` في `Encounter` **بلا رابط اجتماع** | ◐ (فجوة سهلة الإغلاق) |
| صلاحية رسم المتابعة (fee validity) وزيارات مجانية محدودة | `fee_validity/`, `healthcare_practitioner.json` (`enable_free_follow_ups`, `max_visits`, `valid_days`) | `followUpAt` بلا آلية أسعار متابعة | ✖ (منخفضة–متوسطة) |
| ربط سجلات المريض وسجل نشاطه | `patient_medical_record/` (مرجعية ديناميكية لأي Doctype) | `AuditEvent` + سجل وصول المريض + مستندات موحدة | ✔ |
| بوابة مريض | `patient_portal/` (تطبيق Vue مستقل) | بوابة مريض كاملة داخلية (شاشات مواعيد/نتائج/فواتير/عائلة/خصوصية…) | ✔ (BMC أعمق عربيًا) |
| تكامل ABDM (الهند) | `abdm_settings/`, `abdm_request/` | لا يُقابل — خارج السياق البحريني | — |
| ترميزات مركزية | `code_system/`, `code_value/`, `codification_table/` | `LabTest.loinc`, `Problem.icd10` | ◐ (كما في openmrs.md) |

### (ب) Frappe Healthcare — التأمين

| القدرة | الدليل | مقابلها في BMC | الحالة |
|---|---|---|---|
| شركات تأمين وعقود وخطط أهلية لكل خدمة | `insurance_payor/`, `insurance_payor_contract/`, `insurance_payor_eligibility_plan/`, `item_insurance_eligibility/` | `PayerCompany` + `InsurancePolicy` + أسعار/تغطية على `ServiceItem`/`AppointmentType` | ◐ (عقود كنسب عامة، لا قوائم أهلية لكل بند) |
| مطالبة بتغطيات واعتمادات وحالات دفع | `insurance_claim/insurance_claim.json` (25 حقلًا: approved/rejected/paid/outstanding) | دورة مطالبات كاملة `claims/submit|remit` + **موافقات مسبقة PreAuthorization** (غير موجودة في Frappe) | ✔ (مع تفوق BMC بالـpreauth) |
| ربط المطالبة بالفاتورة والعميل | `insurance_claim.json`: `customer`, `mode_of_payment` | `Claim.invoiceId` + `LedgerEntry` | ✔ |

### (ج) ERPNext — الأعمال الخلفية

| الوحدة (ERPNext) | الدليل | مقابلها في BMC | الحالة |
|---|---|---|---|
| محاسبة قيد مزدوج: GL، دفاتر مالية، سنوات مالية، إقفال فترات | `erpnext/accounts/doctype/gl_entry/gl_entry.json` (25 حقلًا)، `fiscal_year/`, `period_closing_voucher/` | `LedgerEntry` (account/debit/credit/periodClosed) — قيد بسيط بلا شجرة حسابات | ◐ |
| 62 تقريرًا محاسبيًا (ميزان، قوائم مالية، ذمم مدينة/دائنة، تدفق نقدي، ميزانيات) | `erpnext/accounts/report/` (balance_sheet, trial_balance, accounts_receivable…) | `GET reports/overview` + رسم إيراد يومي فقط | ✖ مفقود (للإنتاج الفعلي) |
| فوترة ضريبية متعددة العملات + تسعير وقواعد خصم وولاء | `sales_invoice/`, `pricing_rule/`, `loyalty_program/`, `tax_withholding_*` | `Invoice` بـVAT BHD 3 منازل + بطاقات وردية الصندوق + حزم | ✔ لنطاق BHD (بلا ولاء/خصومات مركبة) |
| **شراء: RFQ → عرض مورد → أمر شراء → استلام → فاتورة مورد (AP)** | `erpnext/buying/doctype/` (request_for_quotation, supplier_quotation, purchase_order, supplier_scorecard) + `erpnext/stock/doctype/purchase_receipt/` | `Supplier` دليل جهات فقط + `Batch.poId` نصي بلا كيان أمر شراء | ✖ مفقود |
| مخزون: دفعات/مسلسلات + تقييم (FIFO/MAWS) + جرد + نقل + إعادة ترتيب | `erpnext/stock/doctype/` (batch, serial_and_batch_bundle, stock_ledger_entry, stock_reconciliation, stock_entry, item_reorder, putaway_rule, pick_list) | `Batch`/`StockMove`/`BinLocation` + FEFO صرف الأدوية + حجز قطع لأوامر العمل | ◐ (صرف ممتاز؛ لا تقييم تكلفة ولا جرد دوري ولا إعادة ترتيب آلية رغم حقلي `parLevel/reorderQty` في `Item`) |
| فحوص جودة مخزنية | `stock/doctype/quality_inspection*` | `QcRun` Westgard مخبري (أقوى سريريًا) + حجز/سحب دفعات | ✔ بمجال مختلف |
| أصول: إهلاك مجدول بكتتب مالية + صيانة + إصلاح + تحرك + رأسمالية | `erpnext/assets/doctype/` (asset_depreciation_schedule, asset_maintenance, asset_repair, asset_movement, asset_capitalization) | `Asset` + `MaintenancePlan` + `WorkOrder` (مع محادثة فنيين وقطع) — **بلا إهلاكات محاسبية** | ◐ (CMMS تشغيلي قوي، الأصول المالية غائبة) |
| جودة مؤسسية (أهداف، مراجعات، اجتماعات، عدم مطابقة NCR) | `erpnext/quality_management/doctype/` (quality_goal, quality_review, non_conformance, quality_action) | `Incident`/`Capa`/`Complaint`/`SurveyResponse` NPS | ✔ |
| دعم عملاء بـSLA | `erpnext/support/doctype/` (issue, service_level_agreement) | `Complaint` بمؤشر SLA (overSla) | ✔ |
| مشاريع/مهام/جداول زمنية | `erpnext/projects/doctype/` | `Task` + MDT — بلا وحدة مشاريع | ◐ (كافٍ لعيادات) |
| **رواتب وموارد بشرية كاملة (Payroll/Attendance/Salary Structure)** | **غير موجودة في هذه النسخة** — انتقلت لتطبيق Frappe HR المنفصل (لا يوجد `hr`/`payroll` في `erpnext/erpnext/` ولا في `modules.txt`) | `Employee`/`Shift`/`Leave`/`JobOpening` + إيقاف تلقائي عند انتهاء الترخيص — **لا رواتب ولا حضور** | ✖ (رواتب مفقودة في الطرفين المثبتين محليًا) |

## الفجوات ذات الأولوية

1. **عالية — دورة الشراء والمشتريات**: لا كيان لأمر شراء ولا استلام بضاعة ولا فاتورة مورد في `schema.prisma`؛ المستودع البحريني يعتمد على إدخال دفعات يدوي (`StockMove.type=receipt`). أي نقص سلسلة إمداد حقيقي لا يمكن تتبعه نظاميًا.
2. **عالية — التقارير المالية**: `LedgerEntry` يسجل القيد لكن لا ميزان مراجعة ولا قائمة دخل/مركز مالي؛ ERPNext يوفر 62 تقريرًا جاهزًا (`erpnext/accounts/report/`). لمركز يخضع لمراجعة NHRA/ضريبة VAT هذا عائق إنتاجي.
3. **عالية — الرواتب (Payroll)**: غائبة تمامًا في BMC، وسقطت أيضًا من النسخة المحلية من ERPNext (انتقلت لـFrappe HR). الحد الأدنى المطلوب: هيكل رواتب + مسير شهري بفلس BHD مرتبط بـ`Employee`.
4. **متوسطة — روابط اجتماعات الفيديو للمواعيد التلفزيونية**: `Encounter.type=tele` موجود بلا حقل رابط/انضمام؛ Frappe يولّد رابط Meet تلقائيًا (`patient_appointment.json`).
5. **متوسطة — إعادة الترتيب الآلية للمخزون**: `Item.parLevel/reorderQty` مخزنان ولا شيء يستهلكهما (تحقق `ops.ts` — لا مسار شراء). حد أدنى: إنشاء تنبيه/طلب داخلي عند النزول تحت Par.
6. **متوسطة — الإهلاك المحاسبي للأصول**: أوامر العمل والصيانة ممتازة، لكن لا جدول إهلاك (ERPNext: `asset_depreciation_schedule/`).
7. **منخفضة — ميكروبيولوجيا/حساسيات، IPD، علاج طبيعي، طوارئ، fee-validity، قوالب تمريض**: خارج نطاق مركز عيادات أو تحسينات لاحقة.

## التوصيات

1. إضافة نموذجي `PurchaseOrder` + `GoodsReceipt` (مع `Supplier` الموجود و`Batch.poId`) ومسارات ops مصغرة: طلب → اعتماد → استلام يولّد `StockMove(receipt)` تلقائيًا ويربط التكلفة بالدفعات — يغلق أهم فجوة تشغيلية بأقل نموذج.
2. بناء تقريرين ماليين فوق `LedgerEntry` الموجود: ميزان مراجعة (تجميع بالحساب) وقائمة دخل مبسطة (إيرادات مقابل مصروفات بالفترة) — بلا تغيير في النموذج.
3. رابط اجتماع للمواعيد التلفزيونية: حقل `meetingUrl` على `Appointment` يولّد عند التأكيد (أو تكامل webhook خارجي) — جهد ساعات.
4. تشغيل إعادة الترتيب داخل `scheduler.ts`: فحص دوري للبنود تحت Par وإنشاء إشعار للمخزون + طلب شراء داخلي (يُدمج مع التوصية 1).
5. توثيق قرار "لا IPD/ميكروبيولوجيا/علاج طبيعي" كحدود نطاق صريحة في `docs/` (هذا الملف مرجعها)، وإعادة التقييم عند إضافة خدمات إقامة.
