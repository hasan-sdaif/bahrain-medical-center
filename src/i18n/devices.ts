import type { Dict } from "./index";
const d: Dict = {
  // ── kiosk.website.bh — self check-in kiosk ──
  "kiosk.title": { ar: "كشك الحضور الذاتي", en: "Self Check-in Kiosk" },
  "kiosk.welcome": { ar: "أهلاً بك! سجّل حضورك بنفسك في ثوانٍ", en: "Welcome! Check yourself in, in seconds" },
  "kiosk.scanTitle": { ar: "مسح باركود الموعد", en: "Scan appointment barcode" },
  "kiosk.scanHint": {
    ar: "وجّه باركود الموعد نحو القارئ أو الصقه هنا — يبدأ بالبادئة BMC-APPT",
    en: "Point your appointment barcode at the reader or paste it here — starts with BMC-APPT",
  },
  "kiosk.barcodePlaceholder": { ar: "BMC-APPT-XXXXXXXX", en: "BMC-APPT-XXXXXXXX" },
  "kiosk.cprTitle": { ar: "إدخال الرقم الشخصي", en: "Enter CPR number" },
  "kiosk.cprHint": { ar: "الرقم الشخصي البحريني — ٩ أرقام", en: "Bahraini CPR — 9 digits" },
  "kiosk.submit": { ar: "تسجيل الحضور", en: "Check in" },
  "kiosk.clear": { ar: "مسح", en: "Clear" },
  "kiosk.delete": { ar: "حذف رقم", en: "Delete digit" },
  "kiosk.useCpr": { ar: "ليس لديك باركود؟ الرقم الشخصي", en: "No barcode? Use CPR" },
  "kiosk.useBarcode": { ar: "لديك باركود؟ مسح الموعد", en: "Have a barcode? Scan it" },
  "kiosk.processing": { ar: "جارٍ التحقق من موعدك…", en: "Verifying your appointment…" },
  "kiosk.errTooEarly": {
    ar: "موعدك بعد قليل — عفواً، الحضور يفتح قبل 45 دقيقة من الموعد",
    en: "Your appointment is soon — check-in opens 45 minutes before the appointment time",
  },
  "kiosk.errNotFound": { ar: "لا يوجد موعد فعّال اليوم — استقبال يساعدك", en: "No active appointment today — reception will help you" },
  "kiosk.errCpr": { ar: "الرقم الشخصي غير صحيح — تأكد أنه ٩ أرقام", en: "Invalid CPR — make sure it is 9 digits" },
  "kiosk.errGeneric": { ar: "تعذر إتمام الحضور — حاول مجدداً أو توجه إلى الاستقبال", en: "Check-in failed — try again or see reception" },
  "kiosk.errTitle": { ar: "تنبيه", en: "Notice" },
  "kiosk.demo": { ar: "وضع تجريبي", en: "Demo mode" },
  "kiosk.demoCpr": { ar: "الرقم الشخصي 812030501 — أحمد (موعد اليوم)", en: "CPR 812030501 — Ahmed (appointment today)" },
  "kiosk.demoMrn": { ar: "ملف {mrn} — {name}", en: "MRN {mrn} — {name}" },
  "kiosk.demoBarcodeNote": {
    ar: "انسخ باركود الموعد (BMC-APPT-…) من بوابة المريض ← المواعيد القادمة",
    en: "Copy the appointment barcode (BMC-APPT-…) from Patient Portal → Upcoming",
  },
  "kiosk.successTitle": { ar: "تم تسجيل حضورك بنجاح", en: "You are checked in" },
  "kiosk.ticketLabel": { ar: "رقم تذكرتك", en: "Your ticket" },
  "kiosk.roomLabel": { ar: "الغرفة", en: "Room" },
  "kiosk.waitingCount": { ar: "{n} منتظراً الآن", en: "{n} waiting now" },
  "kiosk.goToRoom": { ar: "توجّه إلى الغرفة {room}", en: "Proceed to room {room}" },
  "kiosk.autoReset": { ar: "تبدأ شاشة جديدة خلال {n} ث", en: "New session in {n}s" },
  "kiosk.finish": { ar: "مريض آخر", en: "Next patient" },
  "kiosk.receptionHelp": { ar: "تحتاج مساعدة؟ الاستقبال جاهز دائماً", en: "Need help? Reception is always ready" },
  "kiosk.mrnLabel": { ar: "رقم الملف", en: "MRN" },

  // ── queue.website.bh — TV waiting-room display ──
  "queue.now": { ar: "الآن", en: "NOW" },
  "queue.room": { ar: "الغرفة", en: "Room" },
  "queue.waiting": { ar: "{n} في الانتظار", en: "{n} waiting" },
  "queue.noCalls": { ar: "في انتظار أول نداء…", en: "Awaiting first call…" },
  "queue.privacy": {
    ar: "لخصوصية المراجعين تُعرض أرقام التذاكر والغرف فقط — دون أسماء",
    en: "For patient privacy, ticket numbers and rooms only — no names",
  },
  "queue.live": { ar: "مباشر", en: "LIVE" },
  "queue.soundOn": { ar: "التنبيه الصوتي مفعّل", en: "Sound alerts on" },
  "queue.soundOff": { ar: "التنبيه الصوتي مكتوم", en: "Sound muted" },
  "queue.updated": { ar: "آخر تحديث {time}", en: "Updated {time}" },
  "queue.error": { ar: "تعذر تحديث الشاشة — نُعيد المحاولة تلقائياً", en: "Display refresh failed — retrying automatically" },
  "queue.connecting": { ar: "جارٍ تحميل شاشة الانتظار…", en: "Loading the waiting screen…" },

  // ── verify.website.bh — public document verification ──
  "verify.title": { ar: "تحقق المستندات", en: "Document Verification" },
  "verify.subtitle": {
    ar: "تأكد من صحة أي مستند صادر عن المركز عبر رمز التحقق المطبوع عليه",
    en: "Confirm the authenticity of any center-issued document using its verification code",
  },
  "verify.codeLabel": { ar: "رمز التحقق", en: "Verification code" },
  "verify.submit": { ar: "تحقق", en: "Verify" },
  "verify.checking": { ar: "جارٍ التحقق…", en: "Verifying…" },
  "verify.tryAgain": { ar: "تحقق من رمز آخر", en: "Verify another code" },
  "verify.validTitle": { ar: "مستند صالح", en: "Valid document" },
  "verify.invalidTitle": { ar: "غير صالح أو ملغى", en: "Invalid or revoked" },
  "verify.kind": { ar: "نوع المستند", en: "Document type" },
  "verify.kind.report": { ar: "تقرير طبي", en: "Medical report" },
  "verify.kind.certificate": { ar: "شهادة طبية", en: "Medical certificate" },
  "verify.kind.sick-leave": { ar: "إجازة مرضية", en: "Sick leave" },
  "verify.kind.referral": { ar: "إحالة", en: "Referral" },
  "verify.kind.prescription": { ar: "وصفة طبية", en: "Prescription" },
  "verify.docTitle": { ar: "عنوان المستند", en: "Document title" },
  "verify.issuedOn": { ar: "تاريخ الإصدار", en: "Issued on" },
  "verify.doctor": { ar: "الطبيب المُصدِر", en: "Issuing doctor" },
  "verify.license": { ar: "رقم الترخيص", en: "License no." },
  "verify.expires": { ar: "صالح حتى", en: "Valid until" },
  "verify.noExpiry": { ar: "بدون تاريخ انتهاء", en: "No expiry date" },
  "verify.invalidHelp": {
    ar: "تأكد من نسخ الرمز كاملاً كما يظهر في بوابة المريض أو على المستند الورقي. إن استمرت المشكلة فتواصل مع الاستقبال",
    en: "Double-check that the code is copied in full as shown in the patient portal or on the paper document. If the problem persists, contact reception",
  },
  "verify.errGeneric": { ar: "تعذر الاتصال بخدمة التحقق — حاول مجدداً", en: "Verification service unreachable — please try again" },
  "verify.demo": { ar: "وضع تجريبي", en: "Demo mode" },
  "verify.demoValidReport": { ar: "تقرير سونار صالح", en: "Valid US report" },
  "verify.demoValidCert": { ar: "شهادة تطعيم صالحة", en: "Valid vaccination certificate" },
  "verify.demoInvalid": { ar: "رمز غير صالح (للعرض)", en: "Invalid code (demo)" },
  "verify.where": {
    ar: "التطبيق الحقيقي: افتح بوابة المريض ← المستندات ← انسخ رمز التحقق أو امسح QR",
    en: "Real codes: open the Patient Portal → Documents → copy the verification code or scan the QR",
  },
  "verify.qrPolicyTitle": { ar: "QR وباركود — متى يستخدم كل منهما؟", en: "QR vs barcode — when is each used?" },
  "verify.qrPolicy": {
    ar: "رمز QR للمستندات الورقية فقط: امسحه بكاميرا هاتفك للوصول إلى هذه الصفحة فوراً. أما باركود Code 128 فمخصص للمسح التشغيلي داخل المركز (الحضور، العينات، الأصول، الأدوية).",
    en: "QR is for paper documents only: scan it with your phone camera to reach this page instantly. Code 128 barcodes are for in-center operational scanning (check-in, samples, assets, medications).",
  },
  "verify.details": { ar: "تفاصيل المستند", en: "Document details" },
  "verify.print": { ar: "طباعة", en: "Print" },
  "verify.errTitle": { ar: "تعذر التحقق", en: "Verification failed" },

  // ── Shamel kiosk shell additions (guide: kiosk-welcome/scan/cpr/confirm) ──
  "kiosk.welcomeTitle": { ar: "أهلاً بك في شامل", en: "Welcome to Shamel" },
  "kiosk.welcomeSub": {
    ar: "سجّل حضورك في أقل من 10 ثوانٍ — اختر طريقتك المفضلة",
    en: "Check in in under 10 seconds — pick your preferred way",
  },
  "kiosk.scanTileSub": { ar: "من هاتفك أو ورقة الموعد", en: "From your phone or appointment slip" },
  "kiosk.a11yWheel": { ar: "تحتاج كرسياً متحركاً؟ اطلب مساعدة من الممرض", en: "Need a wheelchair? Ask the nurse for assistance" },
  "kiosk.a11yEr": { ar: "الطوارئ؟ ادخل من الباب الأيسر مباشرة", en: "Emergency? Use the left door directly" },
  "kiosk.back": { ar: "رجوع", en: "Back" },
  "kiosk.footPrivacy": { ar: "لن تظهر بياناتك الطبية على الكشك — الرقم والوقت فقط", en: "No medical data is shown on the kiosk — number and time only" },
  "kiosk.footLeave": { ar: "اترك الشاشة — ستنتهي الجلسة تلقائياً", en: "Step away — the session ends automatically" },

  // ── Shamel queue screen additions (guide: reception/screen) ──
  "queue.title": { ar: "شاشة الانتظار", en: "Waiting room screen" },
  "queue.entering": { ar: "يدخل الآن", en: "NOW ENTERING" },
  "queue.nextUp": { ar: "التذاكر الحالية", en: "Current tickets" },
  "queue.totalWaiting": { ar: "إجمالي المنتظرين", en: "Total waiting" },
  "queue.pointsCount": { ar: "نقاط خدمة", en: "Service points" },
};

// ── appended: kiosk shell extras ──
d["kiosk.confirm"] = { ar: "تأكيد", en: "Confirm" };

export default d;
