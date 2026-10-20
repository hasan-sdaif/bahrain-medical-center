# مرجع: OHIF Viewer — دراسة مقارنة وتحليل فجوات (R3)

> النظام: OHIF Viewer — عارض DICOM الويب الأشهر (بنية منصات: modes + extensions فوق Cornerstone3D).
> المسار المحلي: `reference-systems/ohif-viewers` (platform/{core,app,ui,ui-next,i18n} + 9 أوضاع + 15 امتدادًا).

## نظرة عامة

OHIF ليس "شاشة أشعة" بل منصة عارضات: كل وضع (mode) يجمع أدوات + لوحات + بروتوكولات تعليق (Hanging Protocols) + مصادر بيانات DICOMweb. وضع `longitudinal` المعلَّب يجمع `measurement-tracking` + التصفح + التجزئة. امتداد `usAnnotation` (الموجات فوق الصوتية — قلب رسالة BMC لأن أغلب فحوصاتنا US) يقدم لوحة وسوم مخصصة ونسبة B-lines الجنبيّة. موقف BMC الحالي: قوالب تقارير منظمة (TI-RADS/BI-RADS) ناضجة، لكن العارض نفسه **محاكاة Canvas رمادية** — وهذه أكبر فجوة تقنية واحدة في المشروع.

## جرد القدرات (القدرة | مقابلها في BMC | الحالة)

| # | القدرة في OHIF (الدليل) | مقابلها في BMC | الحالة |
|---|---|---|---|
| 1 | 26 أداة قياس/تفاعل: WindowLevel, Pan, Zoom, StackScroll (نشطة) + Length, ArrowAnnotate, Bidirectional, SegmentBidirectional, DragProbe, Probe, EllipticalROI, CircleROI, RectangleROI, Angle, CobbAngle, Magnify, PlanarRotate, CalibrationLine, FreehandROI, SplineROI, LivewireContour, UltrasoundDirectional, WindowLevelRegion, ReferenceLines (`modes/basic/src/initToolGroups.ts:26-88`) | لا شيء — لوحة صور ثابتة seeded speckle-noise ("صورة توضيحية — محاكاة DICOM/PACS") في `lab-radreport.tsx` | **فجوة عالية** |
| 2 | 9 أوضاع: basic, longitudinal, segmentation, tmtv, microscopy, usAnnotation, preclinical-4d (+dev/test) (`modes/`) | وضع واحد مبسّط ضمن تبويب الأشعة (`lab-radiology.tsx`) | فجوة عالية |
| 3 | امتدادات DICOM: SR (تقارير منظمة), SEG, RT, PMAP, فيديو, PDF, مجهرية, مجلدات ديناميكية (`extensions/cornerstone-dicom-*/`) | تقارير نصية AR/EN بقوالب (TI-RADS/BI-RADS/عام/بطن/مسالك) — لا DICOM SR | فجوة متوسطة |
| 4 | امتداد الموجات usAnnotation: لوحة وسوم، هندسة المروحة، **نسبة B-lines**، تنزيل الوسوم JSON (`extensions/usAnnotation/src/panels/USAnnotationPanel.tsx`, `PleuraBlinePercentage.ts`, `providers/FanShapeGeometryProvider.ts`) | قالب TI-RADS بحقول حجم/حواف + درجة TR1-TR5 محسوبة (`lab-radreport.tsx`) | BMC أقوى في القالب المنظم؛ OHIF أقوى في الوسم الصوري |
| 5 | تتبع القياسات بين الشرائح + متصفح سلاسل (`extensions/measurement-tracking/src/panels/`) | لا يوجد | فجوة عالية |
| 6 | بروتوكولات تعليق جاهزة: axial أساسي، MPR، fourUp، 3D (`extensions/cornerstone/src/hps/{primaryAxial,mpr,fourUp,main3D}.ts`) | لا يوجد | فجوة متوسطة (تُطلب عند CT/MG مستقبلًا) |
| 7 | قائمة دراسات WorkList بفلاتر وترقيم (`platform/app/src/routes/WorkList/`, `platform/ui/src/components/StudyListTable.tsx` — 28 مكوّن UI) | جدول دراسات الأشعة مع حالة/درجة/توقيع (`lab-radiology.tsx`) | مكافئ وظيفيًا |
| 8 | مقارنة دراسات side-by-side (grids + hanging protocols) | لا يوجد | فجوة متوسطة |
| 9 | بنية خدمات: ViewportService, ToolGroupService, SegmentationService, ColorbarService, SyncGroupService (`extensions/cornerstone/src/services/`) | لا يوجد | فجوة عالية (أساس أي عارض) |
| 10 | TMTV (حجم الورم الأيضي PET) (`extensions/tmtv/`) | خارج النطاق السريري الحالي | غير مطلوب |
| 11 | واجهة DICOMweb + مصادر بيانات متعددة | لا PACS — `imagingStudy.images` = بذور عشوائية (`lab.ts:206`) | فجوة عالية |

## الفجوات ذات الأولوية

1. **عالية — لا عارض حقيقي إطلاقًا**: لا W/L، لا zoom/pan، لا قياس طول/زاوية/ROI، لا تعليقات، لا مقارنة. هذا يقلّص مصداقية "وحدة الأشعة" أمام أي فحص فعلي. الدليل المقابل: 26 أداة نشطة/سلبية في `modes/basic/src/initToolGroups.ts` مقابل canvas رمادية في `lab-radreport.tsx`.
2. **عالية — لا PACS/DICOMweb**: حتى مع عارض، لا توجد طبقة `QIDO-RS/WADO-RS` تجلب مثيلات — `imagingStudy.images` بذور. أي مسار واقعي = خادم Orthanc/dcm4chee جانبي + OHIF كواجهة.
3. **متوسطة — تتبع القياسات وتصديرها**: قياسات OHIF تُحفظ كـ DICOM SR وتظهر في اللوحة الجانبية مع إمكانية التصدير؛ BMC لا يحفظ أي وسوم.
4. **متوسطة — قالب BI-RADS بلا وسوم صورية**: BI-RADS 4a يتطلب وصف الآفة وقياسها على الصورة — اليوم يُكتب نصًا فقط. حتى قبل عارض كامل، رفع صورة حقيقية (upload) + قياسين (طول/عرض) على صورة ثابتة يرفع جودة التقرير.
5. **منخفضة — TMTV/microscopy**: خارج نطاق مركز عام.

## أين يتقدم BMC على المرجع

- **قوالب التقارير المنظمة**: TI-RADS/BI-RADS بحقول إلزامية ودرجة محسوبة (TR/B) — OHIF عارض بلا منطق تقارير طبي جاهز (يستورد DICOM SR فقط).
- ثنائية اللغة AR/EN في التقرير والتوقيع الإلكتروني مع حالات report-draft/signed.
- إلزامية فحص الحمل قبل أنواع الحساسة (`lab.ts:201` CONSENT_REQUIRED) — حوكمة لا يوفرها OHIF.

## ملخص الفجوات بدرجات الخطورة

| الفجوة | الخطورة | الأثر التشغيلي |
|---|---|---|
| لا عارض DICOM حقيقي (26 أداة غائبة) | عالية | لا قياس/تعليق/تعتيم — مصداقية وحدة الأشعة |
| لا PACS/DICOMweb (صور = بذور عشوائية) | عالية | لا يمكن جلب مثيلات فحص فعلية |
| لا تتبع/حفظ القياسات (DICOM SR) | متوسطة | القياسات لا تعيش مع الدراسة ولا تُصدّر |
| لا مقارنة دراسات side-by-side | متوسطة | متابعة تطور الآفات (TI-RADS مقارن) تحتاج يدويًا |
| قالب BI-RADS بلا وسوم صورية | متوسطة | قياس الآفة يُكتب نصًا فقط |
| TMTV/microscopy | منخفضة | خارج نطاق مركز عام |

## أدلة الملفات (Paths Evidence)

- `reference-systems/ohif-viewers/modes/basic/src/initToolGroups.ts` (سطور 26-88) — جرد الأدوات الكامل: نشطة (WindowLevel/Pan/Zoom/StackScroll) + سلبية (Length, ArrowAnnotate, Bidirectional, EllipticalROI, RectangleROI, Angle, CobbAngle, LivewireContour, UltrasoundDirectional...) + مجموعة أدوات SR منفصلة.
- `reference-systems/ohif-viewers/modes/` — 9 أوضاع: basic, longitudinal, segmentation, tmtv, microscopy, usAnnotation, preclinical-4d (+dev/test).
- `reference-systems/ohif-viewers/extensions/` — 15 امتدادًا: cornerstone (services: Viewport/ToolGroup/Segmentation/Colorbar/Sync + hps: mpr, fourUp, main3D), cornerstone-dicom-{sr,seg,rt,pmap,video,dynamic-volume}, dicom-{pdf,video,microscopy}, measurement-tracking, tmtv, usAnnotation.
- `reference-systems/ohif-viewers/extensions/usAnnotation/src/` — USAnnotationPanel.tsx, PleuraBlinePercentage.ts, FanShapeGeometryProvider.ts (نموذج لوحة الموجات).
- `reference-systems/ohif-viewers/platform/app/src/routes/` — WorkList, Mode, Local, LegacyWorkList.
- `reference-systems/ohif-viewers/platform/ui/src/components/` — 28 مكوّن UI (StudyListTable, StudyListFilter, Inputs...).
- المقابل في BMC: `src/components/portals/staff/lab-radiology.tsx` (جدول الدراسات + فحص جديد + إلزام فحص الحمل)، `src/components/portals/staff/lab-radreport.tsx` (قوالب TI-RADS/BI-RADS + Canvas رمادية seeded + مفتاح i18n `lab.rad.image` = "صورة توضيحية — محاكاة DICOM/PACS")، `src/server/staff/lab.ts:184-228` (capture/report/sign).

## التوصيات

- **R1 (خارطة الطريق المقترحة، ثلاث مراحل)**:
  1. **مرحلة الآن (جهد صغير)**: في `lab-radreport.tsx`، استبدال الصورة المولّدة بصورة مرفوعة فعلًا + أداتا Length وEllipticalROI بسيطتان على Canvas (سطور قليلة بحساب بكسل↔مم عبر معايرة يدوية) — يحقق "قياس موثق في التقرير".
  2. **مرحلة قصيرة**: حقول قياس منظمّة (size mm) داخل `radiology/report` لتُخزّن مع الدراسة وتظهر في FHIR DiagnosticReport.
  3. **مرحلة الإنتاج**: حاوية Orthanc + تضمين OHIF بوضع مخصص عبر iframe مع تمرير `StudyInstanceUID` — بروتوكول التعليق US بسيط (viewport واحد).
- **R2**: توثيق قرار "المحاكاة مقصودة" في رأس `lab-radreport.tsx` مع الإحالة لهذا الملف.
- **R3**: عند تبني OHIF: تعيين `usAnnotation` نموذجًا أوليًا للوحة TI-RADS (وسم آفة + حفظ JSON) بدل اختراع لوحة من الصفر.
