/**
 * Seed — realistic bilingual demo data powering all 17 UAT scenarios.
 * Run: bun prisma/seed.ts   (idempotent: wipes + reseeds)
 */
import { db } from "../src/lib/db";
import { blindIndex, sha256, validateCpr } from "../src/lib/bahrain";
import { FILS } from "../src/lib/money";
import { nextMrn, luhnCheckDigit } from "../src/lib/numbering";

const wipe = [
  "aiConversation","paymentWebhook","webBooking","otpCode","readerSession","featureFlag","setting","breakGlass",
  "auditEvent","notification","jobOpening","faq","article","surveyResponse","complaint","capa","incident",
  "instrumentSet","sterilizationCycle","workOrderPart","workOrderMessage","workOrder","maintenanceRequest",
  "maintenancePlan","asset","binLocation","stockMove","batch","item","supplier","homeVisit","homeRequest",
  "coverageZone","handover","pathwayInstance","pathway","task","message","messageThread","mdtCase","mdtMeeting",
  "referral","document","consent","consentTemplate","ledgerEntry","claim","preAuthorization","cashierShift",
  "payment","invoiceLine","invoice","patientPackage","package","serviceItem","insurancePolicy","payerCompany","dispensing",
  "prescriptionItem","prescription","drug","imagingStudy","qcRun","criticalAlert","labResult","specimen",
  "orderItem","order","imagingType","labTest","growthRecord","immunization","medicationStatement","allergy",
  "problem","vitals","encounter","queueTicket","servicePoint","waitlist","appointment","appointmentType",
  "careTeamMember","patientRelationship","patientFlag","patientIdentifier","patient",
  "shift","leave","employee","facilityLicense","department","branch",
];

async function reset(): Promise<void> {
  for (const t of wipe) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db as any)[t.charAt(0).toUpperCase() + t.slice(1)].deleteMany();
  }
  await db.numberSequence.deleteMany();
  console.log("• wiped");
}

const HOORA = { lat: 26.2285, lng: 50.5860 };
const MUHARRAQ = { lat: 26.2572, lng: 50.6119 };
const RIFFA = { lat: 26.1300, lng: 50.5550 };

async function main(): Promise<void> {
  console.log("Seeding BMC…");
  await reset();

  // ── Branch ─────────────────────────────────────────────────────────────────
  const branch = await db.branch.create({
    data: { code: "MAIN", nameAr: "الفرع الرئيسي — الحورة", nameEn: "Main Branch — Hoora", addressAr: "شارع الحكومة، الحورة", addressEn: "Gov Ave, Hoora", phone: "+97317500000", isMain: true, ...HOORA },
  });

  // ── Departments (10) ───────────────────────────────────────────────────────
  const deptData: [string, string, string, string, string, number, string][] = [
    ["GP", "الطب العام وطب الأسرة", "General Practice & Family", "#0d9488", "stethoscope", 1, "standard"],
    ["DENT", "طب الأسنان", "Dentistry", "#0891b2", "smile", 2, "standard"],
    ["SURG", "الجراحة العامة", "General Surgery", "#7c3aed", "scissors", 3, "standard"],
    ["ENDO", "جراحات الغدد الصماء", "Endocrine Surgery", "#ca8a04", "activity", 4, "standard"],
    ["BREAST", "جراحة أورام الثدي والترميم", "Breast Surgery & Reconstruction", "#db2777", "heart", 5, "breast"],
    ["URO", "المسالك البولية", "Urology", "#2563eb", "droplets", 6, "standard"],
    ["ONCO", "الأورام", "Oncology", "#dc2626", "ribbon", 7, "oncology"],
    ["NUTR", "التغذية العلاجية", "Clinical Nutrition", "#65a30d", "apple", 8, "standard"],
    ["PED", "طب الأطفال", "Pediatrics", "#f59e0b", "baby", 9, "standard"],
    ["PSY", "الاختصاص النفسي", "Psychiatry & Psychology", "#475569", "brain", 10, "psych"],
  ];
  const dept: Record<string, { id: string }> = {};
  for (const [code, ar, en, color, icon, order, sens] of deptData) {
    dept[code] = await db.department.create({
      data: {
        code, nameAr: ar, nameEn: en, color, icon, sortOrder: order, sensitive: sens,
        descAr: `${ar} — خدمات متكاملة بتقارير ثنائية اللغة`, descEn: `${en} — integrated bilingual services`,
        branchId: branch.id, roomLabel: `عيادة ${order}`,
        prepAr: "احضر قبل الموعد 15 دقيقة ومعك هوية سارية", prepEn: "Arrive 15 min early with a valid ID",
      },
    });
  }

  // ── Employees ──────────────────────────────────────────────────────────────
  interface EmpSpec { no: string; ar: string; en: string; role: string; titleAr: string; titleEn: string; dept?: string; doctor?: boolean; spec?: [string, string]; gender?: string; licenseDays?: number; photo?: string }
  const emps: EmpSpec[] = [
    { no: "0001", ar: "د. فاطمة العريض", en: "Dr. Fatima Al-Arayedh", role: "doctor", titleAr: "استشارية طب أسرة", titleEn: "Family Medicine Consultant", dept: "GP", doctor: true, spec: ["طب الأسرة", "Family Medicine"], gender: "female", licenseDays: 400 },
    { no: "0002", ar: "د. محمد الشامي", en: "Dr. Mohammed Al-Shami", role: "doctor", titleAr: "استشاري طب أسرة", titleEn: "GP Consultant", dept: "GP", doctor: true, spec: ["طب أسرة", "General Practice"], licenseDays: 420 },
    { no: "0003", ar: "د. ليلى الموسوي", en: "Dr. Layla Al-Mousawi", role: "dentist", titleAr: "استشارية أسنان", titleEn: "Dental Consultant", dept: "DENT", doctor: true, spec: ["ترميم وتجميل أسنان", "Restorative & Cosmetic"], gender: "female", licenseDays: 300 },
    { no: "0004", ar: "د. خالد بن رجب", en: "Dr. Khalid Bin Rajab", role: "surgeon", titleAr: "استشاري جراحة عامة", titleEn: "General Surgery Consultant", dept: "SURG", doctor: true, spec: ["جراحة عامة ومناظير", "General & Laparoscopic"], licenseDays: 500 },
    { no: "0005", ar: "د. أم هاشم القصيبي", en: "Dr. Um Hashim Al-Qassabi", role: "surgeon", titleAr: "استشارية غدد صماء", titleEn: "Endocrine Surgeon", dept: "ENDO", doctor: true, spec: ["جراحة درقية", "Thyroid Surgery"], gender: "female", licenseDays: 260 },
    { no: "0006", ar: "د. هدى كانو", en: "Dr. Huda Kanoo", role: "surgeon", titleAr: "استشارية ثدي وترميم", titleEn: "Breast & Reconstructive Surgeon", dept: "BREAST", doctor: true, spec: ["أورام ثدي وترميم", "Breast Oncoplasty"], gender: "female", licenseDays: 380 },
    { no: "0007", ar: "د. سلمان البنالي", en: "Dr. Salman Al-Binali", role: "surgeon", titleAr: "استشاري مسالك بولية", titleEn: "Urology Consultant", dept: "URO", doctor: true, spec: ["مسالك ومناظير", "Endourology"], licenseDays: 310 },
    { no: "0008", ar: "د. نادية حجي", en: "Dr. Nadia Hijji", role: "oncologist", titleAr: "استشارية أورام", titleEn: "Medical Oncologist", dept: "ONCO", doctor: true, spec: ["أورام عامة", "General Oncology"], gender: "female", licenseDays: 365 },
    { no: "0009", ar: "أ. رهف الزياني", en: "Rahaf Al-Zayani", role: "nutritionist", titleAr: "أخصائية تغذية علاجية", titleEn: "Clinical Dietitian", dept: "NUTR", spec: ["تغذية علاجية", "Clinical Nutrition"], gender: "female", licenseDays: 700 },
    { no: "0010", ar: "د. علي الشمري", en: "Dr. Ali Al-Shammari", role: "pediatrician", titleAr: "استشاري أطفال", titleEn: "Pediatric Consultant", dept: "PED", doctor: true, spec: ["أطفال وحديثي ولادة", "General Pediatrics"], licenseDays: 290 },
    { no: "0011", ar: "د. مريم بوسميط", en: "Dr. Mariam Bu Smait", role: "psychiatrist", titleAr: "استشارية طب نفسي", titleEn: "Psychiatrist", dept: "PSY", doctor: true, spec: ["طب نفسي للبالغين", "Adult Psychiatry"], gender: "female", licenseDays: 240 },
    { no: "0012", ar: "أ. حسن عبدالله", en: "Hasan Abdulla", role: "nurse", titleAr: "ممرض رئيسي", titleEn: "Charge Nurse", gender: "male", licenseDays: 600 },
    { no: "0013", ar: "أ. سارة جاسم", en: "Sara Jassim", role: "nurse", titleAr: "ممرضة فرز", titleEn: "Triage Nurse", gender: "female", licenseDays: 650 },
    { no: "0014", ar: "أ. يوسف الدرازي", en: "Yusuf Dirazi", role: "lab-tech", titleAr: "فني مختبر أول", titleEn: "Senior Lab Technologist", gender: "male", licenseDays: 200 },
    { no: "0015", ar: "أ. مريم ملك", en: "Mariam Malik", role: "phlebotomist", titleAr: "فنية سحب دم", titleEn: "Phlebotomist", gender: "female", licenseDays: 330 },
    { no: "0016", ar: "أ. أحمد الصايغ", en: "Ahmed Al-Sayegh", role: "radiologist", titleAr: "أخصائي أشعة وسونار", titleEn: "Radiologist (US/X-ray)", gender: "male", licenseDays: 280 },
    { no: "0017", ar: "أ. عائشة سنبل", en: "Aisha Sanbel", role: "pharmacist", titleAr: "صيدلية", titleEn: "Pharmacist", gender: "female", licenseDays: 430 },
    { no: "0018", ar: "أ. إبراهيم فخرو", en: "Ibrahim Fakhro", role: "reception", titleAr: "استقبال", titleEn: "Receptionist", gender: "male" },
    { no: "0019", ar: "أ. زينب خليفة", en: "Zainab Khalifa", role: "cashier", titleAr: "أمينة صندوق", titleEn: "Cashier", gender: "female" },
    { no: "0020", ar: "أ. طلال العمادي", en: "Talal Al-Emadi", role: "insurance", titleAr: "موظف تأمين ومطالبات", titleEn: "Insurance & Claims Officer", gender: "male" },
    { no: "0021", ar: "أ. نوّار البهراني", en: "Nawar Al-Bahrani", role: "collector", titleAr: "فني سحب منزلي", titleEn: "Home Phlebotomist", gender: "male", licenseDays: 300 },
    { no: "0022", ar: "أ. حسين منصور", en: "Hussein Mansour", role: "inventory", titleAr: "مدير مخزون", titleEn: "Inventory Manager", gender: "male" },
    { no: "0023", ar: "أ. عبدالكريم عطية", en: "AbdulKarim Attia", role: "maintenance-tech", titleAr: "فني صيانة أجهزة طبية", titleEn: "Biomedical Technician", gender: "male" },
    { no: "0024", ar: "أ. جاسم الدوسري", en: "Jassim Al-Dossari", role: "maintenance-sup", titleAr: "مشرف صيانة ومرافق", titleEn: "Maintenance & Facilities Supervisor", gender: "male" },
    { no: "0025", ar: "أ. منيرة الشماسي", en: "Munira Shamsi", role: "hr", titleAr: "موارد بشرية", titleEn: "HR Officer", gender: "female" },
    { no: "0026", ar: "أ. بدر الذيابة", en: "Badr Al-Thiabah", role: "quality", titleAr: "مسؤول جودة وسلامة", titleEn: "Quality & Safety Officer", gender: "male" },
    { no: "0027", ar: "أ. أمل البنعة", en: "Amal Al-Banaa", role: "dpo", titleAr: "مسؤولة حماية بيانات", titleEn: "Data Protection Officer", gender: "female" },
    { no: "0028", ar: "أ. محمود جنباري", en: "Mahmood Janbari", role: "sysadmin", titleAr: "مسؤول تقنية", titleEn: "System Administrator", gender: "male" },
    { no: "0029", ar: "أ. سلمى عرادي", en: "Salma Aradhi", role: "content", titleAr: "مسؤولة محتوى", titleEn: "Content Officer", gender: "female" },
    { no: "0030", ar: "أ. فيصل المرزوق", en: "Faisal Al-Marzooq", role: "med-director", titleAr: "المدير الطبي", titleEn: "Medical Director", doctor: true, licenseDays: 900 },
    { no: "0031", ar: "أ. عادل المطوع", en: "Adel Al-Mutawa", role: "center-manager", titleAr: "مدير المركز", titleEn: "Center Manager" },
    { no: "0032", ar: "أ. هالة بنعلي", en: "Hala Benali", role: "callcenter", titleAr: "مركز اتصال", titleEn: "Call Center", gender: "female" },
  ];
  const emp: Record<string, { id: string }> = {};
  for (const e of emps) {
    emp[e.no] = await db.employee.create({
      data: {
        staffNo: `EMP-${e.no}`, nameAr: e.ar, nameEn: (e as { en?: string }).en ?? e.ar,
        role: e.role, jobTitleAr: e.titleAr, jobTitleEn: e.titleEn,
        departmentId: e.dept ? dept[e.dept].id : null, branchId: branch.id,
        isDoctor: !!e.doctor, specialtyAr: e.spec?.[0], specialtyEn: e.spec?.[1],
        gender: e.gender ?? "male", languages: ["ar", "en"],
        phone: `+9733${e.no}00000`, email: `emp${e.no}@bmc.bh`,
        username: `emp${e.no}`, active: true,
        licenseNo: e.licenseDays ? `NHRA-${e.no}00` : null,
        licenseAuthority: "NHRA — هيئة تنظيم المهن والخدمات الصحية",
        licenseExpiresAt: e.licenseDays ? new Date(Date.now() + e.licenseDays * 86400000) : null,
        photoUrl: null, accentColor: "#0d9488",
        bioAr: e.doctor ? "خبرة إكلينيكية واسعة مع تقارير ثنائية اللغة ونهج رعاية متمركز حول المريض." : null,
        bioEn: e.doctor ? "Broad clinical experience, bilingual reporting, patient-centered care." : null,
        schedule: { sun: "09:00-13:00,16:00-20:00", mon: "09:00-13:00", tue: "09:00-13:00,16:00-20:00", wed: "09:00-13:00", thu: "09:00-13:00" },
      },
    });
  }

  await db.facilityLicense.createMany({
    data: [
      { kind: "facility", nameAr: "ترخيص المنشأة", nameEn: "Facility License", authority: "NHRA", number: "NHRA-F-2026-118", issuedAt: new Date(Date.now() - 100 * 86400000), expiresAt: new Date(Date.now() + 265 * 86400000), owner: "إدارة المركز" },
      { kind: "lab", nameAr: "ترخيص المختبر", nameEn: "Lab License", authority: "NHRA", number: "NHRA-L-2026-042", issuedAt: new Date(Date.now() - 90 * 86400000), expiresAt: new Date(Date.now() + 275 * 86400000), owner: "المختبر" },
      { kind: "radiology", nameAr: "ترخيص الأشعة", nameEn: "Radiology License", authority: "NHRA", number: "NHRA-R-2026-017", issuedAt: new Date(Date.now() - 80 * 86400000), expiresAt: new Date(Date.now() + 285 * 86400000), owner: "الأشعة" },
    ],
  });

  console.log("• org:", Object.keys(dept).length, "departments,", Object.keys(emp).length, "employees");
  // Seed continues in part 2 (compiled with seed-part2.ts to keep files < 400 lines)
  const { seedPart2 } = await import("./seed-part2");
  await seedPart2({ branch, dept, emp });
  console.log("✔ Seed complete");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
