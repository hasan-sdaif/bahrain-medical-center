/**
 * Seed part 2 — clinical, billing, operations, quality, CMS, settings.
 * Context injected from part 1.
 */
import { db } from "../src/lib/db";
import { blindIndex, sha256 } from "../src/lib/bahrain";
import { luhnCheckDigit } from "../src/lib/numbering";
import { FILS } from "../src/lib/money";
import { growthPercentile } from "../src/lib/algorithms";

interface Ctx {
  branch: { id: string };
  dept: Record<string, { id: string }>;
  emp: Record<string, { id: string }>;
}

// ── date helpers (all UTC; display +3) ──────────────────────────────────────
const now = new Date();
const day = 86400000;
const ago = (d: number, h = 0, m = 0) => new Date(now.getTime() - d * day + h * 3600000 + m * 60000);
const ahead = (d: number, h = 0, m = 0) => new Date(now.getTime() + d * day + h * 3600000 + m * 60000);
const todayAt = (h: number, m = 0) => {
  const d = new Date(now);
  d.setUTCHours(h - 3, m, 0, 0); // BH time → UTC storage
  if (d < now) d.setTime(d.getTime() + day);
  return d;
};

let mrnSeq = 100;
const mkMrn = (): string => {
  mrnSeq++;
  const base = `P26-${String(mrnSeq).padStart(7, "0")}`;
  return `${base}-${luhnCheckDigit(base.replace(/[^0-9]/g, ""))}`;
};

export async function seedPart2(ctx: Ctx): Promise<void> {
  const { branch, dept, emp } = ctx;

  // ── Service points ────────────────────────────────────────────────────────
  const sp = <Record<string, { id: string }>>{};
  const spDefs: [string, string, string, string, string, string][] = [
    ["A", "الاستقبال", "Reception", "reception", "1", "١"],
    ["B", "الفرز التمريضي", "Triage", "triage", "2", "٢"],
    ["C", "عيادة الطبيب", "Clinic", "clinic", "3", "٣"],
    ["D", "سحب الدم", "Phlebotomy", "phlebotomy", "4", "٤"],
    ["E", "المختبر", "Lab", "lab", "5", "٥"],
    ["F", "الأشعة", "Radiology", "radiology", "6", "٦"],
    ["G", "الصيدلية", "Pharmacy", "pharmacy", "7", "٧"],
    ["H", "الصندوق", "Cashier", "cashier", "8", "٨"],
  ];
  for (const [letter, ar, en, kind, room, arNum] of spDefs) {
    sp[letter] = await db.servicePoint.create({ data: { code: letter, nameAr: ar, nameEn: en, kind, room, letter, branchId: branch.id } });
  }

  // ── Appointment types ─────────────────────────────────────────────────────
  const at = <Record<string, { id: string }>>{};
  const atDefs: [string, string, string, string | undefined, number, number, boolean, string, string][] = [
    ["GP-NEW", "استشارة جديدة", "New consultation", "GP", 30, 15000, false, "", ""],
    ["GP-FU", "متابعة", "Follow-up", "GP", 15, 8000, false, "", ""],
    ["GP-COMP", "فحص شامل", "Comprehensive check-up", "GP", 60, 45000, true, "صيام 10 ساعات قبل السحب", "Fast 10 hours before blood draw"],
    ["DENT-EXAM", "فحص أسنان", "Dental exam", "DENT", 30, 12000, false, "", ""],
    ["DENT-PROC", "إجراء أسنان", "Dental procedure", "DENT", 45, 25000, false, "", ""],
    ["SURG-CONS", "تقييم جراحي", "Surgical consult", "SURG", 30, 20000, false, "", ""],
    ["ENDO-CONS", "استشارة غدد صماء", "Endocrine consult", "ENDO", 30, 20000, false, "", ""],
    ["BR-CONS", "فحص ثدي", "Breast consult", "BREAST", 30, 22000, false, "يفضل الحجز بعد انتهاء الدورة", "Prefer booking after cycle"],
    ["URO-CONS", "استشارة مسالك", "Urology consult", "URO", 30, 20000, false, "", ""],
    ["ONCO-CONS", "استشارة أورام", "Oncology consult", "ONCO", 40, 25000, false, "", ""],
    ["NUTR-INIT", "تقييم تغذية أول", "Initial nutrition", "NUTR", 45, 18000, false, "", ""],
    ["PED-ILL", "طفل مريض", "Sick child", "PED", 20, 12000, false, "", ""],
    ["PED-WCC", "متابعة نمو وتطعيم", "Growth & vaccination", "PED", 20, 10000, false, "", ""],
    ["PSY-INIT", "تقييم نفسي أولي", "Psych initial eval", "PSY", 60, 30000, false, "", ""],
    ["PSY-SESS", "جلسة علاجية", "Therapy session", "PSY", 50, 20000, false, "", ""],
    ["GP-TELE", "استشارة عن بعد", "Tele-consultation", "GP", 20, 10000, false, "", ""],
    ["GP-HOME-V", "زيارة سحب منزلي", "Home draw visit", "GP", 30, 0, false, "", ""],
  ];
  for (const [code, ar, en, dc, dur, price, fasting, prepAr, prepEn] of atDefs) {
    at[code] = await db.appointmentType.create({
      data: { code, nameAr: ar, nameEn: en, departmentId: dc ? dept[dc].id : null, durationMin: dur, priceFils: price, requiresFasting: fasting, instructionsAr: prepAr || null, instructionsEn: prepEn || null, isVideo: code === "GP-TELE" },
    });
  }

  // ── Lab catalog ───────────────────────────────────────────────────────────
  const lt = <Record<string, { id: string; unit: string; priceFils: number }>>{};
  const ltDefs: [string, string, string, string, string, number, string, Record<string, { low: number; high: number }>, { low?: number; high?: number }, boolean, string][] = [
    ["CBC", "تعداد دم كامل", "Complete Blood Count", "hematology", "K2EDTA", 9000, "10*9/L", { male: { low: 4.5, high: 11 }, female: { low: 4.5, high: 11 }, child: { low: 5, high: 12.5 } }, { low: 1.5, high: 30 }, true, "CBC (WBC)"],
    ["HGB", "هيموغلوبين", "Hemoglobin", "hematology", "K2EDTA", 4000, "g/dL", { male: { low: 13, high: 17 }, female: { low: 12, high: 15 }, femalePregnant: { low: 11, high: 14 }, child: { low: 11, high: 14 } }, { low: 7, high: 20 }, true, ""],
    ["GLU-F", "سكر صائم", "Fasting Glucose", "chemistry", "Fluoride", 5000, "mmol/L", { male: { low: 3.9, high: 5.6 }, female: { low: 3.9, high: 5.6 } }, { low: 2.2, high: 16.7 }, true, ""],
    ["GLU-R", "سكر عشوائي", "Random Glucose", "chemistry", "Fluoride", 5000, "mmol/L", { male: { low: 3.9, high: 7.8 }, female: { low: 3.9, high: 7.8 } }, { low: 2.2, high: 22 }, true, ""],
    ["HBA1C", "سكر تراكمي", "HbA1c", "chemistry", "K2EDTA", 12000, "%", { male: { low: 4, high: 5.6 }, female: { low: 4, high: 5.6 } }, { low: 3, high: 14 }, true, ""],
    ["CREA", "كرياتينين", "Creatinine", "chemistry", "SST", 5000, "µmol/L", { male: { low: 62, high: 106 }, female: { low: 53, high: 81 }, child: { low: 27, high: 62 } }, { low: 20, high: 500 }, true, ""],
    ["K", "بوتاسيوم", "Potassium", "chemistry", "SST", 5000, "mmol/L", { male: { low: 3.5, high: 5.1 }, female: { low: 3.5, high: 5.1 } }, { low: 2.8, high: 6.0 }, true, ""],
    ["NA", "صوديوم", "Sodium", "chemistry", "SST", 5000, "mmol/L", { male: { low: 136, high: 145 }, female: { low: 136, high: 145 } }, { low: 125, high: 155 }, true, ""],
    ["CHOL", "كوليسترول كلي", "Total Cholesterol", "chemistry", "SST", 6000, "mmol/L", { male: { low: 0, high: 5.2 }, female: { low: 0, high: 5.2 } }, { high: 10 }, true, ""],
    ["HDL", "كوليسترول عالي الكثافة", "HDL", "chemistry", "SST", 6000, "mmol/L", { male: { low: 1.0, high: 2.2 }, female: { low: 1.2, high: 2.4 } }, { low: 0.5 }, true, ""],
    ["TG", "دهون ثلاثية", "Triglycerides", "chemistry", "SST", 6000, "mmol/L", { male: { low: 0, high: 1.7 }, female: { low: 0, high: 1.7 } }, { high: 11 }, true, ""],
    ["LDL-C", "كوليسترول منخفض الكثافة (محسوب)", "LDL (calculated)", "chemistry", "SST", 6000, "mmol/L", { male: { low: 0, high: 3.0 }, female: { low: 0, high: 3.0 } }, { high: 7 }, true, "LDL"],
    ["TSH", "هرمون منبه للدرقية", "TSH", "hormones", "SST", 15000, "mIU/L", { male: { low: 0.55, high: 4.78 }, female: { low: 0.55, high: 4.78 }, femalePregnant: { low: 0.1, high: 2.5 } }, { low: 0.01, high: 100 }, true, ""],
    ["FT4", "T4 حر", "Free T4", "hormones", "SST", 18000, "pmol/L", { male: { low: 11, high: 22 }, female: { low: 11, high: 22 } }, { low: 5, high: 80 }, true, ""],
    ["VITD", "فيتامين د", "Vitamin D (25-OH)", "hormones", "SST", 20000, "nmol/L", { male: { low: 50, high: 250 }, female: { low: 50, high: 250 } }, { low: 10 }, true, ""],
    ["PSA", "مستضد بروستاتا نوعي", "PSA", "hormones", "SST", 22000, "µg/L", { male: { low: 0, high: 4 } }, { high: 20 }, true, ""],
    ["FER", "فيريتين", "Ferritin", "hormones", "SST", 16000, "µg/L", { male: { low: 30, high: 400 }, female: { low: 13, high: 150 }, femalePregnant: { low: 15, high: 150 } }, { low: 5 }, true, ""],
    ["CRP", "بروتين متفاعل", "CRP", "immunology", "SST", 9000, "mg/L", { male: { low: 0, high: 5 }, female: { low: 0, high: 5 } }, { high: 200 }, true, ""],
    ["URE", "يوريا", "Urea", "chemistry", "SST", 5000, "mmol/L", { male: { low: 2.8, high: 8.1 }, female: { low: 2.8, high: 8.1 } }, { high: 30 }, true, ""],
    ["EGFR", "معدل ترشيح الكبيبي (محسوب)", "eGFR (calc)", "chemistry", "SST", 0, "mL/min", { male: { low: 90, high: 9999 }, female: { low: 90, high: 9999 } }, { low: 15 }, true, "eGFR"],
    ["PRL", "برولاكتين", "Prolactin", "hormones", "SST", 18000, "µg/L", { male: { low: 4, high: 15 }, female: { low: 4, high: 23 } }, { high: 200 }, true, ""],
    ["URINE-R", "تحليل بول عام", "Urine routine", "microbiology", "Sterile cup", 6000, "-", { male: { low: 0, high: 0 }, female: { low: 0, high: 0 } }, { high: 1000 }, false, ""],
    ["CULT-U", "مزرعة بول", "Urine culture", "microbiology", "Sterile cup", 25000, "CFU/mL", { male: { low: 0, high: 0 }, female: { low: 0, high: 0 } }, { high: 100000 }, false, ""],
    ["PREG", "هرمون حمل بولي", "Urine pregnancy", "point-of-care", "Sterile cup", 4000, "-", { female: { low: 0, high: 0 } }, { high: 1000 }, false, ""],
    ["SEUM-ABG", "غازات دم شرياني", "ABG", "critical-care", "Heparin syringe", 30000, "mmHg", { male: { low: 7.35, high: 7.45 }, female: { low: 7.35, high: 7.45 } }, { low: 7.1, high: 7.65 }, false, ""],
  ];
  for (const [code, ar, en, cat, tube, price, unit, ref, crit, autoV, calc] of ltDefs) {
    lt[code] = await db.labTest.create({
      data: {
        code, nameAr: ar, nameEn: en, category: cat, tube, priceFils: price, unit, refRange: ref, critical: crit,
        autoVerify: autoV, calcRule: calc || null, fasting: code === "GLU-F" || code === "CHOL" || code === "LDL-C" || code === "TG",
        loinc: code === "GLU-F" ? "1558-7" : code === "HBA1C" ? "4548-4" : code === "TSH" ? "3016-3" : null,
      },
    }) as { id: string; unit: string; priceFils: number };
  }

  // ── Imaging types ─────────────────────────────────────────────────────────
  const im = <Record<string, { id: string }>>{};
  const imDefs: [string, string, string, string, number, string, string, string][] = [
    ["US-ABD", "سونار بطن عام", "Abdominal ultrasound", "US", 15000, "general", "مثانة ممتلئة؛ صيام 6 ساعات", "Full bladder; fast 6h"],
    ["US-NECK", "سونار رقبة ودرقية", "Neck/thyroid US", "US", 15000, "tirads", "لا يوجد تحضير", "No preparation"],
    ["US-BREAST", "سونار ثدي", "Breast US", "US", 18000, "birads", "يفضل بعد الدورة", "Prefer after cycle"],
    ["US-KUB", "سونار كلى ومسالك", "Kidneys & bladder US", "US", 15000, "renal", "مثانة ممتلئة", "Full bladder"],
    ["US-PELVIC", "سونار حوض", "Pelvic US", "US", 16000, "general", "مثانة ممتلئة", "Full bladder"],
    ["DXR-PA", "أشعة صدر", "Chest X-ray", "DXR", 12000, "general", "لا يوجد", "None"],
    ["DXR-BW", "بايت وينغ أسنان", "Bitewing X-ray", "DXR", 8000, "dental", "إزالة أدوات معدنية", "Remove metal objects"],
    ["DXR-PANO", "بانوراما أسنان", "Panoramic dental X-ray", "DXR", 20000, "dental", "إزالة أدوات معدنية", "Remove metal objects"],
    ["MG", "ماموجرام", "Mammogram", "MG", 25000, "birads", "بدون مزيل عرق أو بودرة", "No deodorant/powder"],
  ];
  for (const [code, ar, en, modality, price, template, prepAr, prepEn] of imDefs) {
    im[code] = await db.imagingType.create({ data: { code, nameAr: ar, nameEn: en, modality, priceFils: price, template, prepAr, prepEn, doseMgy: modality === "DXR" ? 0.02 : null } });
  }

  console.log("• catalogs: lab, imaging, appointment types");

  // ── Drugs ─────────────────────────────────────────────────────────────────
  const dr = <Record<string, { id: string }>>{};
  const drDefs: [string, string, string, string, string, string, number, string[], string[], string, number | null, string, boolean, boolean, string | null][] = [
    ["PARA", "باراسيتامول", "Paracetamol", "N02BE01", "tablet", "500mg", 2000, [], [], "B", 4000, "1-2 قرص كل 6 ساعات (حد 8/يوم)|1-2 tabs every 6h (max 8/day)", false, false, null],
    ["AMOX", "أموكسيسيلين", "Amoxicillin", "J01CA04", "capsule", "500mg", 5000, ["penicillin"], ["penicillin"], "B", 3000, "قرص كل 8 ساعات|One cap every 8h", false, false, "Ampicillin"],
    ["AMOX-CLAV", "أموكسيسيلين/كلافيولانيك", "Co-amoxiclav", "J01CR02", "tablet", "625mg", 7000, ["penicillin"], ["penicillin"], "B", 6000, "قرص كل 8 ساعات مع طعام|With food every 8h", false, false, null],
    ["METF", "متفورمين", "Metformin", "A10BA02", "tablet", "500mg", 3000, [], [], "B", 2550, "مع الأكل|With meals", false, false, null],
    ["ATV", "أتورفاستاتين", "Atorvastatin", "C10AA05", "tablet", "20mg", 5000, [], [], "B", 80, "قرص مساءً|Evening dose", false, false, null],
    ["OMEP", "أوميبرازول", "Omeprazole", "A02BC01", "capsule", "20mg", 3000, [], [], "C", 40, "قبل الفطور 30 دقيقة|30min before breakfast", false, false, null],
    ["LEVO-TX", "ليفوتيروكسين", "Levothyroxine", "H03AA01", "tablet", "50mcg", 3000, [], [], "A", 0.2, "صباحاً على معدة فارغة|Morning empty stomach", false, false, null],
    ["INS-R", "إنسولين سريع", "Rapid insulin", "A10AB", "injection", "100IU/ml", 12000, [], [], "B", null, "حسب وصف الطبيب — تحقق مزدوج|Per prescription — double check", false, true, null],
    ["MORPH", "مورفين", "Morphine", "N02AA01", "injection", "10mg/ml", 9000, [], ["opioid"], "C", 60, "خاضع للرقابة — سجل مزدوج|Controlled — dual register", true, true, null],
    ["DIAZ", "ديازيبام", "Diazepam", "N05BA01", "tablet", "5mg", 4000, [], ["opioid", "sedative"], "D", 30, "خاضع للرقابة|Controlled", true, false, null],
    ["WARF", "وارفارين", "Warfarin", "B01AA03", "tablet", "5mg", 5000, [], ["nsaid", "anticoag"], "D", 10, "مع متابعة INR|With INR monitoring", false, true, null],
    ["ASPIRIN", "أسبرين", "Aspirin", "B01AC06", "tablet", "81mg", 1500, ["nsaid"], ["anticoag", "nsaid"], "C", null, "بعد الأكل|After food", false, false, null],
    ["IBU", "إيبوبروفين", "Ibuprofen", "M01AE01", "tablet", "400mg", 2000, ["nsaid"], ["nsaid", "anticoag"], "C", 2400, "مع طعام كل 8 ساعات|With food every 8h", false, false, null],
    ["FLU", "فلوكونازول", "Fluconazole", "J02AC01", "capsule", "150mg", 6000, [], [], "C", 300, "جرعة واحدة|Single dose", false, false, null],
    ["SALB", "سالبوتامول بخاخ", "Salbutamol inhaler", "R03AC02", "inhaler", "100mcg", 8000, [], [], "B", null, "بخختان عند الحاجة|2 puffs PRN", false, false, null],
    ["PRED", "بريدنيزولون", "Prednisolone", "H02AB06", "tablet", "5mg", 3000, [], [], "C", 60, "صباحاً مع طعام|Morning with food", false, true, null],
    ["IRON", "حديد فوماريت", "Ferrous fumarate", "B03AA02", "tablet", "200mg", 2500, [], [], "B", 600, "مع فيتامين C بعد الأكل|With vitamin C after food", false, false, null],
    ["FOL", "حمض فوليك", "Folic acid", "B03BB01", "tablet", "400mcg", 1500, [], [], "A", 5, "يومياً|Daily", false, false, null],
    ["OMEPZ-IV", "أوميبرازول وريدي", "Omeprazole IV", "A02BC01", "injection", "40mg", 15000, [], [], "B", null, "وريدي بطيء|Slow IV", false, true, null],
    ["RANIT", "رانيتيدين", "Ranitidine", "A02BA02", "tablet", "150mg", 2000, [], [], "B", 300, "مرتين يومياً|Twice daily", false, false, null],
  ];
  for (const [code, ar, en, atc, form, strength, price, aTags, iTags, preg, maxMg, doseAr, controlled, highAlert, lookAlike] of drDefs) {
    dr[code] = await db.drug.create({
      data: {
        code, atc, nameAr: ar, nameEn: en, generic: en.split(" ")[0], form, strength, priceFils: price,
        allergyTags: aTags, interactTags: iTags, pregCategory: preg, maxDailyMg: maxMg,
        adultMaxDose: doseAr, controlled, highAlert, lookAlike: lookAlike ?? null,
        stockQty: 40 + (code.length * 7) % 120, parLevel: 15, refrigerated: code === "INS-R",
      },
    });
  }

  // ── Items / batches / bins / suppliers ────────────────────────────────────
  const binStore = await db.binLocation.create({ data: { code: "ST-01", nameAr: "المخزن الرئيسي", nameEn: "Main Store", kind: "store", barcode: "LOC-ST01" } });
  const binShelf = await db.binLocation.create({ data: { code: "SH-A1", nameAr: "رف A1", nameEn: "Shelf A1", kind: "shelf", parentId: null, barcode: "LOC-SHA1" } });
  const sup1 = await db.supplier.create({ data: { nameAr: "مؤسسة الخليج الطبية", nameEn: "Gulf Medical Est.", kind: "medical", contact: "أ. سعيد", phone: "+97317770001", rating: 5 } });
  const sup2 = await db.supplier.create({ data: { nameAr: "شركة البحرين للمستلزمات", nameEn: "Bahrain Consumables Co.", kind: "consumable", contact: "أ. منى", phone: "+97317770002", rating: 4 } });
  const sup3 = await db.supplier.create({ data: { nameAr: "تقنية الخليج للصيانة", nameEn: "Gulf Tech Maintenance", kind: "service", contact: "م. وائل", phone: "+97317770003", rating: 4 } });

  interface ItemDef { code: string; ar: string; en: string; cat: string; uom: string; cost: number; price: number; qty: number; expDays: number; lot: string; controlled?: boolean; sterile?: boolean; storage?: string }
  const itemDefs: ItemDef[] = [
    { code: "ITM-DNT-0001", ar: "قفازات نتريل", en: "Nitrile gloves", cat: "consumable", uom: "box", cost: 2000, price: 3500, qty: 120, expDays: 900, lot: "LOT-260601-01", storage: "ambient" },
    { code: "ITM-DNT-0002", ar: "أنابيب SST 5مل", en: "SST tubes 5ml", cat: "lab-reagent", uom: "pack", cost: 4000, price: 7000, qty: 60, expDays: 400, lot: "LOT-260615-02", storage: "ambient" },
    { code: "ITM-DNT-0003", ar: "كواشف CBC (دفعة)", en: "CBC reagent kit", cat: "lab-reagent", uom: "kit", cost: 30000, price: 45000, qty: 9, expDays: 120, lot: "LOT-260810-03", storage: "fridge" },
    { code: "ITM-DNT-0004", ar: "ملصقات حرارية 40×20", en: "Thermal labels 40×20", cat: "consumable", uom: "roll", cost: 1500, price: 2500, qty: 45, expDays: 700, lot: "LOT-260501-04", storage: "ambient" },
    { code: "ITM-SRV-0005", ar: "محلول معالجة سونار", en: "US gel", cat: "consumable", uom: "bottle", cost: 1200, price: 2000, qty: 30, expDays: 500, lot: "LOT-260701-05", storage: "ambient" },
    { code: "ITM-DNT-0006", ar: "مواد حشو ضوئي", en: "Composite filling kit", cat: "dental", uom: "kit", cost: 25000, price: 40000, qty: 14, expDays: 240, lot: "LOT-260909-06", sterile: true, storage: "ambient" },
    { code: "ITM-BRS-0007", ar: "زرعات ثدي (نموذج)", en: "Breast implant (demo)", cat: "dental", uom: "pc", cost: 250000, price: 380000, qty: 4, expDays: 1000, lot: "LOT-IMP-MFX-77", controlled: true, sterile: true, storage: "ambient" },
    { code: "ITM-SPR-0008", ar: "قطعة غيار مضخة تحليل", en: "Analyzer pump spare", cat: "spare", uom: "pc", cost: 60000, price: 0, qty: 2, expDays: 2000, lot: "LOT-260101-08", storage: "ambient" },
    { code: "ITM-SPR-0009", ar: "فلتر أوتوكلاف", en: "Autoclave filter", cat: "spare", uom: "pc", cost: 8000, price: 0, qty: 5, expDays: 900, lot: "LOT-260202-09", storage: "ambient" },
    { code: "ITM-OFCE-0010", ar: "أوراق طباعة A4", en: "A4 paper", cat: "office", uom: "ream", cost: 2000, price: 0, qty: 25, expDays: 3000, lot: "LOT-260303-10", storage: "ambient" },
  ];
  for (const it of itemDefs) {
    const item = await db.item.create({
      data: { code: it.code, nameAr: it.ar, nameEn: it.en, category: it.cat, uom: it.uom, costFils: it.cost, priceFils: it.price, parLevel: 10, reorderQty: 20, barcode: it.code, controlled: !!it.controlled, sterile: !!it.sterile, storage: it.storage ?? "ambient" },
    });
    const b = await db.batch.create({
      data: { lotNo: it.lot, ownerType: "item", ownerId: item.id, expiry: ahead(it.expDays), qty: it.qty, costFils: it.cost, supplierId: sup2.id, status: "ok" },
    });
    await db.stockMove.create({ data: { batchId: b.id, toBin: binStore.code, qty: it.qty, type: "receipt", byId: emp["0022"].id, refType: "GRN" } });
  }
  // drug batches (FEFO demo: amoxicillin two batches, nearest expiry first)
  const amoxB1 = await db.batch.create({ data: { lotNo: "LOT-260412-A1", ownerType: "drug", ownerId: dr["AMOX"].id, expiry: ahead(45), qty: 30, costFils: 4000, supplierId: sup1.id, status: "ok" } });
  const amoxB2 = await db.batch.create({ data: { lotNo: "LOT-260812-A2", ownerType: "drug", ownerId: dr["AMOX"].id, expiry: ahead(300), qty: 50, costFils: 4200, supplierId: sup1.id, status: "ok" } });
  const paraB = await db.batch.create({ data: { lotNo: "LOT-261001-P1", ownerType: "drug", ownerId: dr["PARA"].id, expiry: ahead(500), qty: 80, costFils: 1500, supplierId: sup1.id, status: "ok" } });
  void amoxB2; void paraB;

  console.log("• pharmacy + inventory");

  // ── Assets + CMMS ─────────────────────────────────────────────────────────
  const pmAnalyzer = await db.maintenancePlan.create({
    data: { titleAr: "صيانة وقائية لمحلل الكيمياء", titleEn: "Chemistry analyzer PM", category: "lab", frequencyDays: 90, checklist: ["فحص الأنابيب", "معايرة", "تنظيف الوحدات", "تحديث البرامج"], parts: [{ code: "ITM-SPR-0008", qty: 1 }], estMinutes: 120 },
  });
  await db.maintenancePlan.create({
    data: { titleAr: "صيانة أوتوكلاف ربع سنوية", titleEn: "Autoclave quarterly PM", category: "sterile", frequencyDays: 90, checklist: ["اختبار مؤشرات حيوية", "تنظيف الحجرة", "فحص الفلتر", "معايرة الحرارة"], parts: [{ code: "ITM-SPR-0009", qty: 1 }], estMinutes: 90 },
  });
  interface AssetDef { code: string; ar: string; en: string; cat: string; model: string; cost: number; status?: string; calib?: number; responsible?: string; pm?: string | null }
  const assetDefs: AssetDef[] = [
    { code: "AST-LAB-001", ar: "محلل كيمياء متعدد", en: "Chemistry analyzer", cat: "lab", model: "Cobas-C311-demo", cost: 18000000, calib: 20, responsible: emp["0014"].id, pm: pmAnalyzer.id },
    { code: "AST-LAB-002", ar: "جهاز تعداد دم", en: "Hematology analyzer", cat: "lab", model: "XN-1000-demo", cost: 9000000, calib: 60, responsible: emp["0014"].id },
    { code: "AST-RAD-003", ar: "جهاز سونار محمول", en: "Portable ultrasound", cat: "radiology", model: "Voluson-i-demo", cost: 12000000, status: "in-maintenance", responsible: emp["0016"].id },
    { code: "AST-RAD-004", ar: "جهاز أشعة أسنان", en: "Dental X-ray", cat: "radiology", model: "DXT-demo", cost: 6000000, calib: 100, responsible: emp["0016"].id },
    { code: "AST-DNT-005", ar: "كرسي أسنان 1", en: "Dental chair #1", cat: "dental", model: "A-dec-demo", cost: 4500000, responsible: emp["0003"].id },
    { code: "AST-DNT-006", ar: "أوتوكلاف", en: "Autoclave", cat: "sterile", model: "Tuttnauer-demo", cost: 3500000, calib: 30, responsible: emp["0012"].id },
    { code: "AST-LAB-007", ar: "جهاز تحليل تركيب الجسم", en: "Body composition analyzer", cat: "lab", model: "InBody-demo", cost: 2500000, responsible: emp["0009"].id },
    { code: "AST-IT-008", ar: "شاشة انتظار الصالة", en: "Waiting hall display", cat: "it", model: "Samsung-55-demo", cost: 300000, responsible: emp["0028"].id },
    { code: "AST-IT-009", ar: "كشك الحضور الذاتي", en: "Self check-in kiosk", cat: "it", model: "Kiosk-K2-demo", cost: 1200000, responsible: emp["0028"].id },
    { code: "AST-IT-010", ar: "قارئ بطاقات الاستقبال", en: "Reception card reader", cat: "it", model: "SCReader-demo", cost: 200000, responsible: emp["0028"].id },
    { code: "AST-FAC-011", ar: "UPS مركزي", en: "Central UPS", cat: "facility", model: "APC-10kVA-demo", cost: 2000000, responsible: emp["0024"].id },
    { code: "AST-VEH-012", ar: "مركبة سحب منزلي 1", en: "Home visit vehicle #1", cat: "vehicle", model: "Hiace-demo", cost: 8000000, responsible: emp["0021"].id },
    { code: "AST-FAC-013", ar: "مكيف غرفة الأشعة", en: "Radiology AC unit", cat: "facility", model: "Split-3T-demo", cost: 400000, responsible: emp["0024"].id },
    { code: "AST-LAB-014", ar: "مجهر مختبر", en: "Lab microscope", cat: "lab", model: "Olympus-demo", cost: 1500000, responsible: emp["0014"].id },
  ];
  const ast = <Record<string, { id: string; code: string }>>{};
  for (const a of assetDefs) {
    ast[a.code] = await db.asset.create({
      data: {
        code: a.code, nameAr: a.ar, nameEn: a.en, category: a.cat, model: a.model,
        serialNo: `${a.model}-${a.code}`, vendorId: sup3.id, purchaseDate: ago(600), costFils: a.cost,
        warrantyUntil: ahead(200), status: a.status ?? "operational", location: "الفرع الرئيسي",
        responsible: a.responsible ?? null, calibrationDueAt: a.calib ? ahead(a.calib) : null,
        pmPlanId: a.pm ?? null,
      },
    });
  }

  // Scenario 16: active fault + work order with chat on the chemistry analyzer
  const fr = await db.maintenanceRequest.create({
    data: {
      code: "FR-261020-006", assetId: ast["AST-LAB-001"].id, reportedBy: emp["0014"].id,
      description: "الجهاز يعرض خطأ ضغط عينة متكرر ولا يقرأ أنابيب QC", impact: "partial", category: "mechanical",
      photos: ["capture1.png"], status: "assigned",
    },
  });
  const wo = await db.workOrder.create({
    data: {
      code: "WO-261020-011", kind: "corrective", assetId: ast["AST-LAB-001"].id, requestId: fr.id,
      technicianId: emp["0023"].id, priority: "high", status: "awaiting-part",
      slaDueAt: ahead(0, 6), startedAt: ago(0, 2), rootCauseAr: null,
      checklist: { steps: [{ t: "فحص مضخة العينة", done: true }, { t: "استبدال القطعة", done: false }, { t: "تشغيل اختباري", done: false }] },
      downtimeMin: 150,
    },
  });
  await db.maintenanceRequest.update({ where: { id: fr.id }, data: { status: "assigned" } });
  const wom = [
    { senderId: emp["0014"].id, body: "الخطأ يظهر عند قراءة الأنبوب رقم 3، جربنا التنظيف دون فائدة.", kind: "text" },
    { senderId: null, body: "تم فتح أمر العمل WO-261020-011 وإسناده إلى فني الأجهزة الطبية.", kind: "system" },
    { senderId: emp["0023"].id, body: "المضخة تحتاج استبدال كامل — طلبت القطعة من المخزن.", kind: "text" },
    { senderId: emp["0023"].id, body: "ITM-SPR-0008 ×1", kind: "part" },
  ];
  for (const m of wom) {
    await db.workOrderMessage.create({ data: { workOrderId: wo.id, senderId: m.senderId, body: m.body, kind: m.kind } });
  }
  const pumpBatch = await db.batch.findFirst({ where: { ownerType: "item", ownerId: (await db.item.findUnique({ where: { code: "ITM-SPR-0008" } }))!.id } });
  if (pumpBatch) {
    await db.workOrderPart.create({ data: { workOrderId: wo.id, batchId: pumpBatch.id, itemCode: "ITM-SPR-0008", qty: 1 } });
  }
  // A closed WO (ultrasound) for MTTR/MTBF history
  const fr2 = await db.maintenanceRequest.create({ data: { code: "FR-261012-005", assetId: ast["AST-RAD-003"].id, reportedBy: emp["0016"].id, description: "السونار لا يقل شاشة اللمس", impact: "full", category: "electrical", status: "closed" } });
  await db.workOrder.create({
    data: { code: "WO-261013-010", kind: "corrective", assetId: ast["AST-RAD-003"].id, requestId: fr2.id, technicianId: emp["0023"].id, priority: "normal", status: "closed", slaDueAt: ago(8), startedAt: ago(8), finishedAt: ago(7, 30), closedAt: ago(7), closedBy: emp["0024"].id, rootCauseAr: "تماس كابل شاشة لمس", actionAr: "إعادة توصيل وعزل الكابل", downtimeMin: 90, signatureBy: emp["0016"].id, checklist: { steps: [{ t: "اختبار بعد الإصلاح", done: true }] } },
  });

  console.log("• assets + CMMS (1 active WO w/ chat, 1 closed)");

  // ── Payers ────────────────────────────────────────────────────────────────
  const payer = <Record<string, { id: string }>>{};
  const payerDefs: [string, string, string, string, number, number][] = [
    ["BH-ASSUR", "بسمة — التأمين الصحية", "Basma Health Insurance", "insurance", 5000, 10],
    ["GULF-MED", "الخليج للتأمين الطبي", "Gulf Medical Insurance", "insurance", 3000, 20],
    ["CORP-OIL", "شركة نفط البحرين (حساب شركة)", "Bapco (corporate account)", "corporate", 2000, 0],
  ];
  for (const [code, ar, en, kind, copay, coins] of payerDefs) {
    payer[code] = await db.payerCompany.create({
      data: { code, nameAr: ar, nameEn: en, kind, contact: "قسم المطالبات", phone: "+97317800000", coverage: { preauthRequired: ["MG", "MRI", "SURG-CONS", "ONCO-CONS"], exclusions: ["تجميل", "cosmetic"], waitingPeriodDays: 30 }, creditLimitFils: kind === "corporate" ? 50000000 : 0 },
    });
    void copay; void coins;
  }

  // ── Patients ──────────────────────────────────────────────────────────────
  interface PatDef { cpr?: string; gcc?: [string, string]; pass?: [string, string, number?]; tmp?: boolean; first: string; father: string; family: string; firstEn?: string; familyEn?: string; dob: string; gender: "male" | "female"; nat: string; mother?: string; phone: string; gov: string; area: string; block: string; building: string; pregnant?: boolean; vip?: boolean; staffMember?: boolean; psych?: boolean; assurance?: number; payer?: string; copay?: number; coins?: number; membership?: string; blood?: string; chronic?: string; allergy?: [string, string]; kids?: boolean; homeZone?: string }
  const patDefs: PatDef[] = [
    { cpr: "812030501", first: "أحمد", father: "إبراهيم", family: "الخالدي", firstEn: "Ahmed", familyEn: "Al-Khalidi", dob: "1984-03-05", gender: "male", nat: "البحرين", mother: "مريم حسن", phone: "+97339112233", gov: "capital", area: "الحورة", block: "318", building: "بيت 12", payer: "BH-ASSUR", membership: "BSM-88213", copay: 5000, coins: 10, blood: "O+", chronic: "سكري نوع 2 — متابعة", allergy: ["بنسلين", "rash"], homeZone: "capital" },
    { cpr: "910050202", first: "مريم", father: "عبدالله", family: "المعاملي", firstEn: "Mariam", familyEn: "Al-Maamari", dob: "1990-05-02", gender: "female", nat: "البحرين", mother: "فاطمة علي", phone: "+97336445566", gov: "capital", area: "العدلية", block: "334", building: "فيلا 7", payer: "GULF-MED", membership: "GM-77120", copay: 3000, coins: 20, blood: "A+", chronic: "درقية نشطة", homeZone: "capital" },
    { cpr: "880512301", first: "حسن", father: "سعيد", family: "جاسم", firstEn: "Hasan", familyEn: "Jassim", dob: "1988-05-12", gender: "male", nat: "البحرين", mother: "نورة محمد", phone: "+97337001122", gov: "muharraq", area: "المحرق", block: "216", building: "بيت 45", payer: "CORP-OIL", membership: "BAP-3301", blood: "B+", staffMember: true, homeZone: "muharraq" },
    { gcc: ["SA", "1025487712"], first: "سلطان", father: "ناصر", family: "القحطاني", firstEn: "Sultan", familyEn: "Al-Qahtani", dob: "1979-11-30", gender: "male", nat: "السعودية", phone: "+97336002244", gov: "muharraq", area: "البديع", block: "224", building: "فندق الخليج — غرفة 310", assurance: 2, homeZone: "muharraq" },
    { pass: ["DE", "C4X99T221", 400], first: "كلاوس", father: "", family: "فيرنر", firstEn: "Klaus", familyEn: "Werner", dob: "1972-08-19", gender: "male", nat: "ألمانيا", phone: "+97339007788", gov: "capital", area: "جفير", block: "333", building: "فندق الدبلوماسي — 1204", assurance: 2, homeZone: "capital" },
    { cpr: "950309401", first: "سلمى", father: "محمد", family: "الأنصاري", firstEn: "Salma", familyEn: "Al-Ansari", dob: "1995-03-09", gender: "female", nat: "البحرين", mother: "هدى يوسف", phone: "+97338003399", gov: "northern", area: "الرفاع", block: "612", building: "فيلا 21", payer: "BH-ASSUR", membership: "BSM-90342", copay: 5000, coins: 10, pregnant: true, blood: "O-", homeZone: "northern" },
    { cpr: "841107501", first: "أمل", father: "جعفر", family: "الشماسي", firstEn: "Amal", familyEn: "Al-Shamasi", dob: "1984-11-07", gender: "female", nat: "البحرين", mother: "زينب حسن", phone: "+97333445511", gov: "capital", area: "المنامة", block: "328", building: "شقة 9", payer: "GULF-MED", membership: "GM-71009", copay: 3000, coins: 20, homeZone: "capital" },
    { cpr: "201806125", first: "علي", father: "أحمد", family: "المنصوري", firstEn: "Ali", familyEn: "Al-Mansoori", dob: "2021-06-12", gender: "male", nat: "البحرين", mother: "سلمى الأنصاري", phone: "+97338003399", gov: "northern", area: "الرفاع", block: "612", building: "فيلا 21", kids: true, assurance: 2, homeZone: "northern" },
    { cpr: "830219402", first: "خالد", father: "عمر", family: "الرويعي", firstEn: "Khalid", familyEn: "Al-Ruwaei", dob: "1983-02-19", gender: "male", nat: "البحرين", mother: "منيرة فريد", phone: "+97333221100", gov: "southern", area: "عالي", block: "701", building: "بيت 3", chronic: "ضغط + دهون", blood: "AB+", vip: true, homeZone: "southern" },
    { cpr: "920915301", first: "نورة", father: "علي", family: "بوصفير", firstEn: "Noura", familyEn: "Bo Sfeir", dob: "1992-09-15", gender: "female", nat: "البحرين", mother: "سعاد محمود", phone: "+97337554433", gov: "capital", area: "القضيبية", block: "336", building: "فيلا 14", psych: true, homeZone: "capital" },
    { cpr: "876543210", first: "فاطمة", father: "حسين", family: "البلوشي", firstEn: "Fatima", familyEn: "Al-Balushi", dob: "1976-12-01", gender: "female", nat: "البحرين", mother: "خديجة صالح", phone: "+97336677889", gov: "muharraq", area: "الحالة", block: "204", building: "بيت 88", payer: "BH-ASSUR", membership: "BSM-88117", copay: 5000, coins: 10, chronic: "سكري + درقية", homeZone: "muharraq" },
    { pass: ["GB", "BRP778120", 250], first: "إيما", father: "", family: "تايلور", firstEn: "Emma", familyEn: "Taylor", dob: "1989-04-14", gender: "female", nat: "المملكة المتحدة", phone: "+97339882211", gov: "capital", area: "جفير", block: "331", building: "برج 22 — 1502", assurance: 2, homeZone: "capital" },
  ];
  const pt = <Record<string, { id: string; mrn: string }>>({});
  const patList: { id: string; mrn: string; name: string; dob: Date; gender: string; phone: string; mother?: string }[] = [];
  for (const p of patDefs) {
    const mrn = mkMrn();
    const rec = await db.patient.create({
      data: {
        mrn, assurance: p.assurance ?? (p.cpr ? 2 : 3),
        firstNameAr: p.first, fatherAr: p.father, familyAr: p.family,
        firstNameEn: p.firstEn ?? p.first, familyEn: p.familyEn ?? p.family,
        latinName: `${p.firstEn ?? p.first} ${p.familyEn ?? p.family}`,
        dob: new Date(p.dob), gender: p.gender, nationality: p.nat, motherNameAr: p.mother ?? null,
        phone: p.phone, preferredLang: "ar", bloodType: p.blood ?? null,
        address: { governorate: p.gov, area: p.area, block: p.block, building: p.building, road: String(Math.floor(Math.random() * 900) + 100), notes: "البوابة الخلفية أقرب" },
        emergency: { nameAr: "طوارئ المنزل", relation: "زوج/زوجة", phone: p.phone },
      },
    });
    pt[p.phone] = { id: rec.id, mrn };
    patList.push({ id: rec.id, mrn, name: `${p.first} ${p.family}`, dob: new Date(p.dob), gender: p.gender, phone: p.phone, mother: p.mother });
    if (p.cpr) {
      await db.patientIdentifier.create({ data: { patientId: rec.id, type: "CPR", number: p.cpr, country: "BH", source: "chip", blindIndex: blindIndex("CPR", p.cpr, "BH"), expiresAt: ahead(2000) } });
    }
    if (p.gcc) {
      await db.patientIdentifier.create({ data: { patientId: rec.id, type: "GCC_ID", number: p.gcc[1], country: p.gcc[0], source: "visual", blindIndex: blindIndex("GCC_ID", p.gcc[1], p.gcc[0]), expiresAt: ahead(300) } });
    }
    if (p.pass) {
      await db.patientIdentifier.create({ data: { patientId: rec.id, type: "PASSPORT", number: p.pass[1], country: p.pass[0], source: "visual", blindIndex: blindIndex("PASSPORT", p.pass[1], p.pass[0]), expiresAt: ahead(p.pass[2] ?? 365) } });
    }
    const flags: { kind: string; valueAr?: string; valueEn?: string; severity?: string }[] = [];
    if (p.chronic) flags.push({ kind: "chronic", valueAr: p.chronic, valueEn: p.chronic, severity: "info" });
    if (p.allergy) flags.push({ kind: "allergy", valueAr: `حساسية ${p.allergy[0]}`, valueEn: `Allergy: ${p.allergy[0]}`, severity: "critical" });
    if (p.pregnant) flags.push({ kind: "pregnant", valueAr: "حامل — الثلث الثاني", valueEn: "Pregnant — 2nd trimester", severity: "warn" });
    if (p.vip) flags.push({ kind: "vip", valueAr: "شخصية عامة (VIP)", valueEn: "Public figure (VIP)", severity: "warn" });
    if (p.staffMember) flags.push({ kind: "staff-member", valueAr: "موظف بالمركز", valueEn: "Staff member", severity: "warn" });
    if (p.psych) flags.push({ kind: "restricted", valueAr: "سجل نفسي معزول", valueEn: "Isolated psych record", severity: "critical" });
    if (p.kids) flags.push({ kind: "minor", valueAr: "قاصر — قرارات الولي", valueEn: "Minor — guardian consent", severity: "warn" });
    for (const f of flags) {
      await db.patientFlag.create({ data: { patientId: rec.id, kind: f.kind, valueAr: f.valueAr, valueEn: f.valueEn, severity: f.severity ?? "info" } });
    }
    if (p.payer) {
      await db.insurancePolicy.create({
        data: { patientId: rec.id, payerId: payer[p.payer].id, membershipNo: p.membership ?? "N/A", category: "standard", copayFils: p.copay ?? 0, coinsPct: p.coins ?? 0, ceilingFils: 10000000, validUntil: ahead(300) },
      });
    }
    // Care team for chronic patients
    if (p.chronic) {
      await db.careTeamMember.create({ data: { patientId: rec.id, employeeId: emp["0001"].id, role: "primary", autoFrom: "appointment" } });
    }
  }
  // relationships: guardian (Salma → Ali child), Amal→ (self, breast case), staff member Hasan patient
  const salma = pt["+97338003399"]; const ali = patList.find((x) => x.name.startsWith("علي"))!;
  const amal = patList.find((x) => x.name.startsWith("أمل"))!;
  await db.patientRelationship.create({ data: { patientId: ali.id, relatedId: salma.id, relation: "guardian", verifiedBy: emp["0018"].id, verifiedAt: ago(30) } });
  const hasanPat = patList.find((x) => x.name.startsWith("حسن"))!;
  void hasanPat;

  console.log("• patients:", patList.length);

  // ── Coverage zones (home service — all Bahrain) ───────────────────────────
  const zoneDefs: [string, string[], number, number, number][] = [
    ["capital", ["المنامة", "الحورة", "العدلية", "جفير", "القضيبية", "الرفاع؟ لا"], 3000, 0, 1500],
    ["muharraq", ["المحرق", "البديع", "الحالة", "عراد", "حلّة عبدالصمد"], 3500, 0, 1500],
    ["northern", ["الرفاع", "المدينة حمد", "بني جامرة", "المقلة"], 4500, 0, 2000],
    ["southern", ["عالي", "الرفاع الغربي", "سترة", "حوض الصافي"], 5000, 0, 2000],
  ];
  const zone = <Record<string, { id: string }>>{};
  for (const [gov, areas, fee, morning, evening] of zoneDefs) {
    zone[gov] = await db.coverageZone.create({ data: { governorate: gov, areas: areas.filter((a) => !a.includes("؟")), feeFils: fee, morningFils: morning, eveningFils: evening, holidayFils: fee + 1000, minOrderFils: 15000 } });
  }

  // ── Consent templates (19) ────────────────────────────────────────────────
  const ctDefs: [string, string, string, string, string, boolean, number][] = [
    ["consent.treatment", "موافقة عامة على العلاج", "General treatment consent", "أقر بأنني تلقيت شرحاً للخدمات العلاجية ووافيت عليها طواعية.", "I acknowledge the explained treatment and consent freely.", true, 365],
    ["consent.privacy", "إشعار الخصوصية", "Privacy notice", "بياناتي الصحية حساسة وتعالج وفق قانون حماية البيانات الشخصي البحريني.", "My health data is sensitive and processed under BH PDPL.", true, 365],
    ["consent.data-sharing", "مشاركة البيانات مع التأمين", "Data sharing with payer", "أوافق على مشاركة الفواتير والتقارير المطلوبة مع شركة التأمين لأغراض المطالبات فقط.", "I approve sharing billing/medical reports with my insurer for claims only.", true, 365],
    ["consent.marketing", "الاتصال والتسويق", "Contact & marketing", "أوافق على استلام عروض ومواعيد تذكير عبر SMS/واتساب (اختياري وقابل للسحب).", "Optional: offers/reminders via SMS/WhatsApp (withdrawable).", false, 365],
    ["consent.clinical-photo", "التصوير السريري", "Clinical photography", "أوافق على توثيق صور سريرية داخل الملف، وموافقة منفصلة لأي استخدام تعليمي/نشر.", "Consent for clinical photos in the record; separate approval for publication.", false, 365],
    ["consent.surgery", "موافقة جراحة", "Surgery consent", "شرحت لي العملية ومخاطرها وبدائلها بما فيها التخدير والنزف والعدوى.", "Risks, alternatives, anesthesia explained to me.", true, 30],
    ["consent.anesthesia", "موافقة تخدير", "Anesthesia consent", "أناقش خطة التخدير ومخاطره مع طبيب التخدير وأوافق عليها.", "Anesthesia plan and risks discussed.", true, 30],
    ["consent.transfusion", "موافقة نقل دم", "Blood transfusion consent", "أوافق على نقل الدم/مكوناته عند الحاجة مع شرح المخاطر.", "Transfusion consent with risks explained.", true, 30],
    ["consent.chemo", "موافقة علاج كيميائي", "Chemotherapy consent", "شرح لي بروتوكول العلاج والآثار المتوقعة وخطة متابعتها.", "Protocol and expected toxicities explained.", true, 90],
    ["consent.psy", "موافقة علاج نفسي", "Psychotherapy consent", "أقر بفهم حدود السرية وأن ملاحظات العلاج الخاص لا يطلع عليها غير كاتبها.", "I understand confidentiality bounds; private therapy notes stay sealed.", true, 180],
    ["consent.tele", "موافقة استشارة عن بعد", "Tele-consultation consent", "أوافق على استشارة عن بعد بحدودها، ولن يتم تسجيل الجلسة.", "Tele-consult with its limits; no recording.", true, 180],
    ["consent.home-draw", "موافقة سحب منزلي", "Home draw consent", "أوافق على سحب عينة في منزلي والتحقق من هوية الفني قبل البدء.", "Home sampling with technician identity verification.", true, 180],
    ["consent.third-party-delivery", "تسليم لطرف ثالث", "Third-party delivery", "أفوض [الاسم] باستلام نتائجي بعد التحقق من هويته.", "I authorize [name] to receive my results after ID verification.", false, 90],
    ["consent.research", "مشاركة في أبحاث/جودة", "Research participation", "موافقة اختيارية مستقلة، لا تؤثر على خدمتي.", "Optional and independent; never affects my care.", false, 365],
    ["consent.refusal", "رفض علاج / خروج ضد النصيحة", "Refusal / AMA", "أرفض العلاج المقترح وأتحمل مسؤولية قراري بعد شرح المخاطر.", "I refuse the proposed treatment after risks explained.", true, 30],
    ["consent.financial", "المسؤولية المالية", "Financial responsibility", "ألتزم بسداد المستحقات وسياسة الإلغاء والاسترداد المعروضة.", "I accept the financial, cancellation & refund policy.", true, 365],
    ["consent.receipt", "إقرار استلام", "Receipt acknowledgment", "استلمت [البند] وتسلّمت بطاقة الزراعة إن وجدت.", "I received the item(s) incl. implant card if any.", true, 365],
    ["consent.delegation", "تفويض شخص", "Delegation", "أفوّض [الاسم] بصلاحيات محددة ومدة محددة.", "I delegate [name] limited powers for a limited period.", false, 90],
    ["consent.guardian", "موافقة ولي أمر", "Guardian consent", "أنا الولي/الوصي الشرعي وأوافق على [الإجراء] للقاصر.", "I am the legal guardian and consent to [procedure] for the minor.", true, 180],
  ];
  const ct = <Record<string, { id: string; version: number }>>{};
  for (const [key, ar, en, bodyAr, bodyEn, hard, days] of ctDefs) {
    const t = await db.consentTemplate.create({ data: { key, version: 1, kind: key.replace("consent.", ""), titleAr: ar, titleEn: en, bodyAr: `${bodyAr}\n\nالنسخة 1 — اعتماد المدير الطبي.`, bodyEn: `${bodyEn}\n\nVersion 1 — Medical Director approved.`, hardStop: hard, validDays: days, approvedBy: emp["0030"].id } });
    ct[key] = { id: t.id, version: 1 };
  }

  // ── Past clinical history (Amal breast scenario, chronic patients) ────────
  // Amal: breast lump → referral → imaging BI-RADS → pending biopsy (open MDT)
  const amalEnc = await db.encounter.create({
    data: { code: "V-261015-0101", patientId: amal.id, departmentId: dept["GP"].id, doctorId: emp["0001"].id, type: "consultation", status: "closed", chief: "كتلة في الثدي الأيسر منذ شهر", hpi: "لا ألم، لا إفرازات، لا قصة عائلية معروفة", exam: "كتلة 2سم رباعية علوية غربية يسارى، حرة الحركة، لا عقد إبطية", assessment: "كتلة ثدي يسارى — يستوجب تقييماً تخصصياً", plan: "إحالة عاجلة لجراحة الثدي + سونار وماموجرام", startedAt: ago(5), closedAt: ago(5, 0, 40), signedAt: ago(5, 0, 41) },
  });
  await db.problem.create({ data: { patientId: amal.id, encounterId: amalEnc.id, icd10: "N63.2", nameAr: "كتلة ثدي غير محددة", nameEn: "Unspecified lump in breast", notedBy: emp["0001"].id } });
  const refAmal = await db.referral.create({
    data: { code: "RF-261016-0041", patientId: amal.id, fromId: emp["0001"].id, toDepartmentId: dept["BREAST"].id, toId: emp["0006"].id, kind: "formal", urgency: "urgent", status: "scheduled", reason: "كتلة ثدي يسارى جديدة", summary: { icd10: "N63.2", meds: [], lastResults: [] }, responseDueAt: ahead(0, 20), respondedAt: ago(4), reportAr: "مقبولة — حجز سونار وماموجرام غداً", createdAt: ago(4) },
  });
  // imaging for Amal
  const amalStudy = await db.imagingStudy.create({
    data: { code: "IMG-261017-0031", patientId: amal.id, typeId: im["US-BREAST"].id, status: "signed", performedAt: ago(3, 10), performedBy: emp["0016"].id, images: [{ seed: "us-breast-1", captionAr: "مستعرض علوية غربية", captionEn: "Supero-lateral transverse" }], template: "birads", findingsAr: "كتلة 18×14مم غير منتظمة الحدود مع ظل خلفي — إدراج ماموجرام", reportAr: "كتلة صلبة 18×14مم بالربع العلوي الخارجي للثدي الأيسر، غير منتظمة الحدود، BI-RADS 4a — يُنصح بخزعة.", reportEn: "Solid irregular 18×14mm mass, UOQ left breast, BI-RADS 4a — biopsy advised.", grade: "BI-RADS 4a", signedBy: emp["0016"].id, signedAt: ago(3, 11) },
  });
  // MDT with Amal's case
  const mdt = await db.mdtMeeting.create({ data: { titleAr: "اجتماع فريق أورام الثدي", titleEn: "Breast tumor board", kind: "tumor-board", scheduledAt: ahead(1, 11), status: "scheduled" } });
  await db.mdtCase.create({ data: { meetingId: mdt.id, patientId: amal.id, questionAr: "خطة الخزعة والتسلسل: خزعة مسبار قبل أي قرار جراحي؟", status: "listed" } });

  // Chronic history for Ahmed (diabetes)
  const ahmed = patList[0];
  await db.problem.createMany({
    data: [
      { patientId: ahmed.id, icd10: "E11.9", nameAr: "سكري نوع 2", nameEn: "Type 2 DM", notedBy: emp["0001"].id },
      { patientId: ahmed.id, icd10: "E78.5", nameAr: "ارتفاع دهون", nameEn: "Hyperlipidemia", notedBy: emp["0001"].id },
    ],
  });
  await db.allergy.create({ data: { patientId: ahmed.id, substance: "بنسلين", reaction: "طفح", severity: "severe", notedBy: emp["0001"].id } });
  await db.medicationStatement.createMany({
    data: [
      { patientId: ahmed.id, drugId: dr["METF"].id, nameAr: "متفورمين", nameEn: "Metformin", dose: "500mg مرتين", status: "active", source: "prescribed" },
      { patientId: ahmed.id, drugId: dr["ATV"].id, nameAr: "أتورفاستاتين", nameEn: "Atorvastatin", dose: "20mg مساءً", status: "active", source: "prescribed" },
    ],
  });
  await db.vitals.createMany({
    data: [
      { patientId: ahmed.id, recordedBy: emp["0012"].id, tempC: 36.7, pulse: 78, resp: 16, bpSys: 132, bpDia: 84, spo2: 98, weightKg: 88, heightCm: 176, bmi: 28.4, waistCm: 102, recordedAt: ago(30) },
      { patientId: ahmed.id, recordedBy: emp["0013"].id, tempC: 36.6, pulse: 76, resp: 16, bpSys: 128, bpDia: 80, spo2: 99, weightKg: 86.5, heightCm: 176, bmi: 27.9, waistCm: 100, recordedAt: ago(2) },
      { patientId: amal.id, recordedBy: emp["0013"].id, tempC: 36.8, pulse: 82, bpSys: 118, bpDia: 74, spo2: 99, recordedAt: ago(5) },
    ],
  });
  // growth records for Ali (child) with percentiles
  for (const [ageM, w, h] of [[6, 8.1, 68], [12, 9.8, 76], [18, 11.2, 82], [24, 12.4, 88], [52, 17.2, 106]] as [number, number, number][]) {
    const gp = growthPercentile("weight", w, ageM, "male");
    const gh = growthPercentile("height", h, ageM, "male");
    await db.growthRecord.createMany({ data: [ { patientId: ali.id, metric: "weight", value: w, ageMonths: ageM, z: gp.z, percentile: gp.percentile, flag: gp.flag, recordedAt: ago(300 - ageM * 5) }, { patientId: ali.id, metric: "height", value: h, ageMonths: ageM, z: gh.z, percentile: gh.percentile, flag: gh.flag, recordedAt: ago(300 - ageM * 5) } ] });
  }
  // immunizations for Ali
  await db.immunization.createMany({
    data: [
      { patientId: ali.id, vaccine: "شلل فموي (OPV)", vaccineEn: "OPV", doseLabel: "الجرعة 4", givenAt: ago(400), batch: "LOT-V-2201", site: "فم", givenBy: emp["0012"].id },
      { patientId: ali.id, vaccine: "الثلاثي (MMR)", vaccineEn: "MMR", doseLabel: "الجرعة 1", givenAt: ago(300), batch: "LOT-V-2302", site: "فخذ أيسر", givenBy: emp["0012"].id, nextDueAt: ahead(60) },
    ],
  });

  console.log("• clinical history + MDT + referrals");

  // ── Today's board: appointments + queue ───────────────────────────────────
  interface ApptDef { patIdx: number; at: string; type: string; dept: string; empNo: string; status: string; channel: string; checkin?: string }
  const apptDefs: ApptDef[] = [
    { patIdx: 0, at: "GP-NEW", type: "09:00", dept: "GP", empNo: "0001", status: "arrived", channel: "portal", checkin: "barcode" },
    { patIdx: 1, at: "ENDO-CONS", type: "09:30", dept: "ENDO", empNo: "0005", status: "confirmed", channel: "portal" },
    { patIdx: 5, at: "GP-FU", type: "10:00", dept: "GP", empNo: "0001", status: "confirmed", channel: "callcenter" },
    { patIdx: 6, at: "BR-CONS", type: "10:30", dept: "BREAST", empNo: "0006", status: "confirmed", channel: "referral" },
    { patIdx: 7, at: "PED-WCC", type: "11:00", dept: "PED", empNo: "0010", status: "confirmed", channel: "portal", checkin: undefined },
    { patIdx: 9, at: "PSY-INIT", type: "11:30", dept: "PSY", empNo: "0011", status: "requested", channel: "portal" },
    { patIdx: 8, at: "GP-COMP", type: "08:30", dept: "GP", empNo: "0002", status: "completed", channel: "reception", checkin: "manual" },
    { patIdx: 3, at: "GP-NEW", type: "12:00", dept: "GP", empNo: "0002", status: "confirmed", channel: "web" },
    { patIdx: 10, at: "GP-FU", type: "16:00", dept: "GP", empNo: "0001", status: "confirmed", channel: "reception" },
    { patIdx: 4, at: "GP-TELE", type: "17:00", dept: "GP", empNo: "0001", status: "confirmed", channel: "portal" },
  ];
  const apptRows: { id: string; patientId: string; code: string }[] = [];
  let apptSeq = 41;
  for (const a of apptDefs) {
    const t = at[a.at];
    const start = todayAt(Number(a.type.slice(0, 2)), Number(a.type.slice(3)) || 0);
    const dur = a.at === "GP-COMP" ? 60 : 30;
    const code = `A-261020-${String(apptSeq++).padStart(4, "0")}`;
    const rec = await db.appointment.create({
      data: {
        code, patientId: patList[a.patIdx].id, departmentId: dept[a.dept].id, employeeId: emp[a.empNo].id, appointmentTypeId: t.id,
        start, end: new Date(start.getTime() + dur * 60000), status: a.status, channel: a.channel,
        priceFils: 15000, paymentStatus: a.status === "completed" ? "paid" : "unpaid",
        checkinAt: a.checkin ? todayAt(8, 20) : null, checkinMethod: a.checkin ?? null,
        createdBy: "emp0018",
      },
    });
    apptRows.push({ id: rec.id, patientId: rec.patientId, code: rec.code });
  }
  // Queue tickets for arrived patients + walk-ins
  const tickDefs: [string, number, string, string, string, string | null][] = [
    ["A", 42, "waiting", "elderly", "reception", null],
    ["C", 7, "called", "normal", "clinic", "٣"],
    ["D", 3, "waiting", "child", "kiosk", null],
    ["G", 5, "serving", "normal", "pharmacy", "٧"],
    ["H", 9, "waiting", "normal", "cashier", null],
    ["B", 1, "waiting", "pregnant", "reception", null],
  ];
  for (const [letter, n, status, priority, src, room] of tickDefs) {
    await db.queueTicket.create({
      data: {
        code: `${letter}-${String(n).padStart(3, "0")}`, patientId: patList[n % patList.length].id,
        servicePointId: sp[letter].id, priority, status, issuedAt: todayAt(8, 15),
        calledAt: status === "called" || status === "serving" ? todayAt(9, 5) : null,
        roomLabel: room, waitedMin: status === "waiting" ? 12 + n : 0, source: src,
      },
    });
  }

  // ── Lab orders: one critical K+ pending escalation, others routine ─────────
  const ord1 = await db.order.create({
    data: { code: "O-261020-0512", patientId: ahmed.id, doctorId: emp["0001"].id, kind: "lab", priority: "routine", status: "in-progress", reason: "متابعة سكري ثلاثية", priceFils: 32000, paymentStatus: "paid", createdAt: ago(0, 3), items: { create: [ { nameAr: "سكر تراكمي", nameEn: "HbA1c", labTestId: lt["HBA1C"].id, qty: 1, priceFils: 12000, status: "resulted" }, { nameAr: "كرياتينين", nameEn: "Creatinine", labTestId: lt["CREA"].id, qty: 1, priceFils: 5000, status: "resulted" }, { nameAr: "دهون كاملة", nameEn: "Lipid panel", labTestId: lt["CHOL"].id, qty: 1, priceFils: 18000, status: "collected" } ] } },
  });
  // Fatima (T2DM+thyroid) — the CRIT potassium 6.9 scenario (resulted, awaiting verification, alert new)
  const fatima = patList[10];
  const ord2 = await db.order.create({
    data: { code: "O-261020-0513", patientId: fatima.id, doctorId: emp["0001"].id, kind: "lab", priority: "stat", status: "in-progress", reason: "وهن عام — شاملة", priceFils: 45000, paymentStatus: "insured", createdAt: ago(0, 4), items: { create: [ { nameAr: "بوتاسيوم", nameEn: "Potassium", labTestId: lt["K"].id, qty: 1, priceFils: 5000, status: "resulted" }, { nameAr: "تعداد دم كامل", nameEn: "CBC", labTestId: lt["CBC"].id, qty: 1, priceFils: 9000, status: "resulted" }, { nameAr: "سكر صائم", nameEn: "Fasting glucose", labTestId: lt["GLU-F"].id, qty: 1, priceFils: 5000, status: "resulted" }, { nameAr: "TSH", nameEn: "TSH", labTestId: lt["TSH"].id, qty: 1, priceFils: 15000, status: "resulted" }, { nameAr: "فيتامين د", nameEn: "Vitamin D", labTestId: lt["VITD"].id, qty: 1, priceFils: 20000, status: "collected" } ] } },
  });
  // specimens + results
  const spec1 = await db.specimen.create({ data: { code: "S-261020-0231", orderId: ord1.id, patientId: ahmed.id, tube: "SST", status: "received", collectedAt: ago(0, 2, 30), collectedBy: emp["0015"].id, receivedAt: ago(0, 2), receivedBy: emp["0014"].id, chain: [{ at: ago(0, 2, 30), by: "EMP-0015", ev: "collected" }, { at: ago(0, 2), by: "EMP-0014", ev: "handed-over" }] } });
  const spec2 = await db.specimen.create({ data: { code: "S-261020-0232", orderId: ord2.id, patientId: fatima.id, tube: "SST", status: "received", collectedAt: ago(0, 3), collectedBy: emp["0015"].id, receivedAt: ago(0, 2, 40), receivedBy: emp["0014"].id, chain: [{ at: ago(0, 3), by: "EMP-0015", ev: "collected" }, { at: ago(0, 2, 40), by: "EMP-0014", ev: "handed-over" }] } });
  void spec1; void spec2;
  const items1 = await db.orderItem.findMany({ where: { orderId: ord1.id } });
  const hba1c = items1.find((x) => x.nameEn === "HbA1c")!;
  const crea = items1.find((x) => x.nameEn === "Creatinine")!;
  const r1 = await db.labResult.create({ data: { orderItemId: hba1c.id, patientId: ahmed.id, testId: lt["HBA1C"].id, value: 7.8, unit: "%", flag: "H", refLow: 4, refHigh: 5.6, resultedAt: ago(0, 1, 30), source: "analyzer", resultedBy: emp["0014"].id, verifiedAt: ago(0, 1, 20), verifiedBy: emp["0014"].id, autoVerified: true, comment: "غير منضبط — يُنصح بمراجعة الخطة العلاجية", prevValue: 7.2, deltaPct: 8.3, releasedAt: ago(0, 1, 10), releasedBy: emp["0014"].id } });
  await db.labResult.create({ data: { orderItemId: crea.id, patientId: ahmed.id, testId: lt["CREA"].id, value: 92, unit: "µmol/L", flag: "normal", refLow: 62, refHigh: 106, resultedAt: ago(0, 1, 25), source: "analyzer", resultedBy: emp["0014"].id, verifiedAt: ago(0, 1, 15), verifiedBy: emp["0014"].id, autoVerified: true, releasedAt: ago(0, 1, 5), releasedBy: emp["0014"].id } });
  const items2 = await db.orderItem.findMany({ where: { orderId: ord2.id } });
  const kItem = items2.find((x) => x.nameEn === "Potassium")!;
  const cbcItem = items2.find((x) => x.nameEn === "CBC")!;
  const gluItem = items2.find((x) => x.nameEn === "Fasting glucose")!;
  const tshItem = items2.find((x) => x.nameEn === "TSH")!;
  const rK = await db.labResult.create({ data: { orderItemId: kItem.id, patientId: fatima.id, testId: lt["K"].id, value: 6.9, unit: "mmol/L", flag: "CRIT", refLow: 3.5, refHigh: 5.1, resultedAt: ago(0, 0, 50), source: "analyzer", resultedBy: emp["0014"].id, comment: "انحلال عينة مشتبه — أعيد السحب للتأكيد؟ تم التأكيد بمقياس ثانٍ" } });
  await db.criticalAlert.create({ data: { resultId: rK.id, patientId: fatima.id, status: "new", notifiedAt: ago(0, 0, 45), channel: "inapp", log: [{ at: ago(0, 0, 45), ev: "notified-doctor", who: "EMP-0001" }] } });
  await db.labResult.create({ data: { orderItemId: cbcItem.id, patientId: fatima.id, testId: lt["CBC"].id, value: 6.2, unit: "10*9/L", flag: "normal", refLow: 4.5, refHigh: 11, resultedAt: ago(0, 0, 45), source: "analyzer", resultedBy: emp["0014"].id, autoVerified: true, verifiedAt: ago(0, 0, 40), verifiedBy: emp["0014"].id, releasedAt: ago(0, 0, 35), releasedBy: emp["0014"].id } });
  const rGlu = await db.labResult.create({ data: { orderItemId: gluItem.id, patientId: fatima.id, testId: lt["GLU-F"].id, value: 9.8, unit: "mmol/L", flag: "H", refLow: 3.9, refHigh: 5.6, resultedAt: ago(0, 0, 40), source: "analyzer", resultedBy: emp["0014"].id } });
  await db.labResult.create({ data: { orderItemId: tshItem.id, patientId: fatima.id, testId: lt["TSH"].id, value: 6.4, unit: "mIU/L", flag: "H", refLow: 0.55, refHigh: 4.78, resultedAt: ago(0, 0, 35), source: "analyzer", resultedBy: emp["0014"].id, comment: "قصور درقية تحت سريرية — يستدعي FT4" } });
  void rGlu; void r1;
  // QC runs (Westgard demo: analyzer passing, one warning)
  await db.qcRun.createMany({
    data: [
      { testId: lt["K"].id, assetId: ast["AST-LAB-001"].id, level: 2, target: 4.5, observed: 4.4, status: "passed", lotNo: "QC-102", runAt: ago(0, 6) },
      { testId: lt["HGB"].id, assetId: ast["AST-LAB-001"].id, level: 2, target: 12.5, observed: 12.4, status: "passed", lotNo: "QC-102", runAt: ago(0, 6) },
      { testId: lt["GLU-F"].id, assetId: ast["AST-LAB-001"].id, level: 1, target: 5.0, observed: 5.6, status: "warned", rule: "2-2s", lotNo: "QC-102", runAt: ago(1) },
    ],
  });

  // Amal biopsy referral order (imaging done; pending surgery scheduling — pre-op gate incomplete)
  const ord3 = await db.order.create({
    data: { code: "O-261019-0509", patientId: amal.id, doctorId: emp["0006"].id, kind: "imaging", status: "reported", reason: "خزعة مسبار موجهة بالسونار", priority: "urgent", priceFils: 25000, paymentStatus: "insured", createdAt: ago(1, 9), items: { create: [{ nameAr: "خزعة مسبار ثدي", nameEn: "Core needle biopsy", qty: 1, priceFils: 25000, status: "resulted" }] }, signedAt: ago(1, 9) },
  });
  void ord3; void amalStudy;

  console.log("• lab orders + critical alert (K 6.9) + QC");

  // ── Prescription: Ahmed follow-up Rx + one pending in pharmacy ─────────────
  const rx1 = await db.prescription.create({
    data: {
      code: "RX-261020-0093", patientId: ahmed.id, doctorId: emp["0001"].id, encounterId: amalEnc.id ? undefined : undefined,
      status: "dispensed", signedAt: ago(0, 1), safety: { errors: [], warnings: [] },
      createdAt: ago(0, 1, 5),
      items: { create: [ { drugId: dr["METF"].id, doseAr: "1000mg", doseEn: "1000mg", route: "oral", frequency: "مرتين يومياً", durationDays: 30, qty: 60, refills: 1, instrAr: "مع الوجبات", instrEn: "With meals" }, { drugId: dr["ATV"].id, doseAr: "20mg", doseEn: "20mg", route: "oral", frequency: "مساءً", durationDays: 30, qty: 30, refills: 1, instrAr: "بعد العشاء", instrEn: "After dinner" } ] },
    },
  });
  const rx1Items = await db.prescriptionItem.findMany({ where: { prescriptionId: rx1.id } });
  for (const it of rx1Items) {
    await db.dispensing.create({
      data: { prescriptionItemId: it.id, batchId: amoxB1.id, qty: it.qty, status: "dispensed", dispensedBy: emp["0017"].id, dispensedAt: ago(0, 0, 30), labelAr: `${it.doseAr} — ${it.frequency}`, labelEn: `${it.doseEn} — as directed`, counseled: true, paymentStatus: "paid", deliveredVia: "counter" },
    });
  }
  // Pending Rx for Fatima (metformin + iron) in pharmacy queue
  const rx2 = await db.prescription.create({
    data: {
      code: "RX-261020-0094", patientId: fatima.id, doctorId: emp["0001"].id, status: "pharmacy-review", signedAt: ago(0, 0, 40), safety: { errors: [], warnings: [{ code: "HIGH_ALERT_DRUG", ar: "دواء عالي الخطورة", en: "High-alert" }] }, createdAt: ago(0, 0, 45),
      items: { create: [ { drugId: dr["METF"].id, doseAr: "850mg", doseEn: "850mg", route: "oral", frequency: "ثلاث مرات", durationDays: 30, qty: 90, refills: 0, instrAr: "مع الأكل", instrEn: "With food" }, { drugId: dr["IRON"].id, doseAr: "200mg", doseEn: "200mg", route: "oral", frequency: "يومياً", durationDays: 60, qty: 60, instrAr: "بعد الغداء", instrEn: "After lunch" } ] },
    },
  });
  void rx2;

  // ── Invoices / payments / claims / preauths ───────────────────────────────
  const inv1 = await db.invoice.create({
    data: {
      code: "INV-2026-004512", patientId: ahmed.id, status: "paid", subtotalFils: 35000, vatFils: 1750, totalFils: 36750, patientFils: 36750, insurerFils: 0, issuedAt: todayAt(8, 45), cashierId: emp["0019"].id,
      lines: { create: [ { kind: "consultation", nameAr: "استشارة طب أسرة", nameEn: "Family consult", qty: 1, unitFils: 15000, vatBp: 500, grossFils: 15000, vatFils: 750 }, { kind: "lab", nameAr: "تحاليل متابعة سكري", nameEn: "DM follow-up labs", qty: 1, unitFils: 20000, vatBp: 500, grossFils: 20000, vatFils: 1000 } ] },
    },
  });
  await db.payment.create({ data: { code: "PAY-2026-006201", invoiceId: inv1.id, patientId: ahmed.id, method: "benefit", amountFils: 36750, status: "captured", txnRef: "BNF-88231", idempotencyKey: sha256("seed-pay-1").slice(0, 24), receivedBy: emp["0019"].id, benefitRef: "BNF-88231", receivedAt: todayAt(8, 46) } });
  const inv2 = await db.invoice.create({
    data: {
      code: "INV-2026-004513", patientId: amal.id, status: "issued", subtotalFils: 43000, discountFils: 0, vatFils: 2150, totalFils: 45150, patientFils: 9030, insurerFils: 36120, issuedAt: todayAt(9, 10), cashierId: emp["0019"].id,
      lines: { create: [ { kind: "consultation", refId: null, nameAr: "استشارة ثدي (وصف محايد)", nameEn: "Consultation", qty: 1, unitFils: 22000, vatBp: 500, grossFils: 22000, vatFils: 1100 }, { kind: "imaging", nameAr: "سونار ثدي", nameEn: "Breast US", qty: 1, unitFils: 18000, vatBp: 500, grossFils: 18000, vatFils: 900 }, { kind: "consent", nameAr: "موافقة موقعة", nameEn: "Signed consent", qty: 1, unitFils: 3000, vatBp: 500, grossFils: 3000, vatFils: 150 } ] },
      neutralDesc: "استشارة",
    },
  });
  void inv2;
  // Pre-auth for Amal surgery (approved with ref)
  const pa1 = await db.preAuthorization.create({ data: { code: "PA-261020-003", patientId: amal.id, payerId: payer["GULF-MED"].id, serviceRef: "BR-SURG-BIOPSY", status: "approved", requestedAt: ago(1), approvedRef: "GM-AUTH-77213", validUntil: ahead(30), amountFils: 2500000, notes: "تشمل الخزعة والتقييم الجراحي" } });
  // Claim lifecycle: prepared → submitted (Ahmed), rejected→resubmitted (Mariam endocrine)
  await db.claim.create({ data: { code: "CLM-261020-0031", patientId: fatima.id, payerId: payer["BH-ASSUR"].id, invoiceIds: [inv1.id], status: "submitted", submittedAt: ago(0, 1), billedFils: 36750, approvedFils: 0 } });
  const mariam = patList[1];
  await db.claim.create({ data: { code: "CLM-261018-0029", patientId: mariam.id, payerId: payer["GULF-MED"].id, invoiceIds: [], status: "rejected", submittedAt: ago(2), billedFils: 58000, approvedFils: 0, rejectReason: "ترميز التشخيص ناقص (ICD-10)" } });
  await db.cashierShift.create({ data: { cashierId: emp["0019"].id, openedAt: todayAt(8, 0), openingFils: 10000, status: "open" } });
  void pa1;
  // Ledger entries
  await db.ledgerEntry.createMany({
    data: [
      { account: "1100-الصندوق", debitFils: 36750, memoAr: "تحصيل INV-2026-004512", refType: "payment", postedBy: emp["0019"].id },
      { account: "2100-ذمم مرضى", creditFils: 36750, memoAr: "تسوية فاتورة 4512", refType: "invoice", postedBy: emp["0019"].id },
      { account: "4100-إيراد استشارات", creditFils: 35000, memoAr: "إيراد يوم 20-10", refType: "invoice", postedBy: emp["0019"].id },
      { account: "3100-ضريبة مستحقة", creditFils: 1750, memoAr: "VAT 5%", refType: "invoice", postedBy: emp["0019"].id },
    ],
  });

  // ── Consents signed (Amal surgery chain incomplete → hard-stop demo) ──────
  await db.consent.create({ data: { code: "CST-261020-0077", templateKey: "consent.treatment", templateVersion: 1, patientId: ahmed.id, method: "tablet", signedBy: "أحمد الخالدي", signedAt: ago(30), status: "active", hash: sha256("c1"), evidence: { device: "WS-001", ip: "10.0.0.12" }, readSeconds: 14 } });
  await db.consent.create({ data: { code: "CST-261020-0078", templateKey: "consent.data-sharing", templateVersion: 1, patientId: ahmed.id, method: "portal", signedBy: "أحمد الخالدي", signedAt: ago(30), status: "active", otpVerified: true, hash: sha256("c2"), evidence: { device: "portal", ip: "10.20.3.4" }, readSeconds: 22 } });
  await db.consent.create({ data: { code: "CST-261019-0070", templateKey: "consent.home-draw", templateVersion: 1, patientId: fatima.id, method: "portal", signedBy: "فاطمة البلوشي", signedAt: ago(1), status: "active", otpVerified: true, hash: sha256("c3"), readSeconds: 12 } });
  const salmaPat = pt["+97338003399"];
  await db.consent.create({ data: { code: "CST-261020-0079", templateKey: "consent.guardian", templateVersion: 1, patientId: ali.id, method: "tablet", signedBy: "سلمى الأنصاري (الولية)", signedAt: ago(0, 2), status: "active", hash: sha256("c4"), witnessId: emp["0018"].id, evidence: { relation: "guardian", verifiedBy: "EMP-0018" }, readSeconds: 18 } });
  void salmaPat;

  // ── Documents + verification codes ────────────────────────────────────────
  const doc1 = await db.document.create({
    data: { kind: "report", patientId: amal.id, issuedBy: emp["0016"].id, titleAr: "تقرير سونار ثدي — BI-RADS 4a", titleEn: "Breast US report — BI-RADS 4a", bodyAr: "كتلة صلبة 18×14مم بالربع العلوي الخارجي يسارى. التوصية: خزعة مسبار.", bodyEn: "18×14mm solid mass UOQ left. Recommendation: core biopsy.", payload: { grade: "BI-RADS 4a" }, verifyCode: `BMC-${sha256("doc1").slice(0, 22).toUpperCase()}`, issuedAt: ago(3, 11), expiryAt: ahead(90) },
  });
  await db.document.create({
    data: { kind: "certificate", patientId: ali.id, issuedBy: emp["0010"].id, titleAr: "شهادة تطعيم", titleEn: "Vaccination certificate", bodyAr: "استكمل علي المنصوري جدول التطعيمات حسب الجدول الوطني.", bodyEn: "Up to date per national schedule.", payload: { doses: 2 }, verifyCode: `BMC-${sha256("doc2").slice(0, 22).toUpperCase()}`, issuedAt: ago(300) },
  });
  void doc1;

  // ── Messaging + tasks ─────────────────────────────────────────────────────
  const th1 = await db.messageThread.create({ data: { patientId: amal.id, subjectAr: "تنسيق حالة أمل — ثدي", subjectEn: "Amal breast case coordination", category: "clinical", createdBy: emp["0001"].id, participants: [emp["0001"].id, emp["0006"].id, emp["0016"].id, emp["0008"].id], patientScoped: true, lastAt: ago(1) } });
  await db.message.createMany({
    data: [
      { threadId: th1.id, senderId: emp["0016"].id, body: "السونار أُدرج BI-RADS 4a — رفعت التقرير في الملف.", createdAt: ago(3, 11), readBy: [emp["0001"].id] },
      { threadId: th1.id, senderId: emp["0006"].id, body: "استلمت. طلبت موافقة تأمين مسبقة للخزعة — صدرت GM-AUTH-77213.", createdAt: ago(1), readBy: [emp["0001"].id, emp["0016"].id] },
      { threadId: th1.id, senderId: null, senderRole: "system", body: "أُضيفت الحالة لاجتماع فريق الثدي غداً 11:00.", system: true, createdAt: ago(0, 2) },
    ],
  });
  await db.task.createMany({
    data: [
      { titleAr: "مراجعة نتيجة بوتاسيوم حرجة وتوثيق التواصل", assigneeId: emp["0001"].id, role: "doctor", patientId: fatima.id, status: "new", priority: "urgent", dueAt: ahead(0, 1), kind: "critical-result" },
      { titleAr: "الاتصال بمريضة أمل لجدولة الخزعة", assigneeId: emp["0018"].id, role: "reception", patientId: amal.id, status: "new", priority: "normal", dueAt: ahead(1), kind: "callback" },
      { titleAr: "متابعة موافقة تأمين أمل — جراحة", assigneeId: emp["0020"].id, role: "insurance", patientId: amal.id, status: "in-progress", priority: "normal", dueAt: ahead(0, 4), kind: "preauth" },
      { titleAr: "تسليم قطعة المضخة لفني الصيانة", assigneeId: emp["0022"].id, role: "inventory", status: "new", priority: "high", dueAt: ahead(0, 6), kind: "part-issue", refType: "work-order", refId: wo.id },
    ],
  });

  // ── Home visits (Muharraq scenario 8 + pending requests) ───────────────────
  const hv1 = await db.homeRequest.create({
    data: { code: "HV-261020-0021", patientId: patList[2].id, channel: "portal", tests: [{ code: "VIT-D", nameAr: "فيتامين د", priceFils: 20000, fasting: false }, { code: "HBA1C", nameAr: "سكر تراكمي", priceFils: 12000, fasting: false }], address: { governorate: "muharraq", area: "المحرق", block: "216", building: "بيت 45", notes: "البوابة الخلفية" }, slot: "صباحاً 07:30-09:00", prefGender: "any", fasting: true, status: "confirmed", feeFils: 3500, zoneId: zone["muharraq"].id, notesAr: "المريض صائم — جدولة مبكرة", createdAt: ago(1), confirmedAt: ago(1) },
  });
  await db.homeVisit.create({ data: { requestId: hv1.id, collectorId: emp["0021"].id, routeOrder: 1, eta: todayAt(7, 45), coldChain: [], incidents: [] } });
  await db.homeRequest.create({ data: { code: "HV-261020-0022", patientId: patList[5].id, channel: "portal", tests: [{ code: "GLU-F", nameAr: "سكر صائم", priceFils: 5000, fasting: true }, { code: "CBC", nameAr: "تعداد دم", priceFils: 9000, fasting: false }], address: { governorate: "northern", area: "الرفاع", block: "612", building: "فيلا 21" }, slot: "صباحاً", fasting: true, status: "requested", feeFils: 4500, zoneId: zone["northern"].id, createdAt: ago(0, 2) } });
  await db.homeRequest.create({ data: { code: "HV-261020-0023", patientId: patList[8].id, channel: "callcenter", tests: [{ code: "PREG", nameAr: "اختبار حمل", priceFils: 4000, fasting: false }], address: { governorate: "southern", area: "عالي", block: "701", building: "بيت 3" }, slot: "مساءً", fasting: false, status: "requested", feeFils: 5000, zoneId: zone["southern"].id, createdAt: ago(0, 3) } });

  // ── Pathways ──────────────────────────────────────────────────────────────
  const pw = await db.pathway.create({ data: { code: "PW-COMP", nameAr: "الفحص الشامل متعدد المحطات", nameEn: "Comprehensive multi-station check-up", steps: [ { key: "register", ar: "التسجيل", en: "Registration" }, { key: "fast-draw", ar: "صيام وسحب دم", en: "Fasting draw" }, { key: "body-comp", ar: "تركيب الجسم", en: "Body composition" }, { key: "us", ar: "سونار", en: "Ultrasound" }, { key: "consult", ar: "استشارة الطبيب", en: "Physician consult" }, { key: "nutrition", ar: "تغذية", en: "Nutrition" }, { key: "results", ar: "استلام النتائج", en: "Results delivery" } ] } });
  await db.pathwayInstance.create({ data: { pathwayId: pw.id, patientId: patList[8].id, currentStep: 3, status: "active", startedAt: todayAt(8) } });

  // ── HR extras ─────────────────────────────────────────────────────────────
  await db.shift.createMany({
    data: [
      { employeeId: emp["0001"].id, date: todayAt(0), kind: "morning", start: todayAt(9), end: todayAt(13) },
      { employeeId: emp["0001"].id, date: todayAt(0), kind: "evening", start: todayAt(16), end: todayAt(20) },
      { employeeId: emp["0014"].id, date: todayAt(0), kind: "morning", start: todayAt(8), end: todayAt(16) },
      { employeeId: emp["0023"].id, date: todayAt(0), kind: "oncall", start: todayAt(17), end: ahead(1, 8) },
    ],
  });
  await db.leave.create({ data: { employeeId: emp["0002"].id, type: "annual", from: ahead(3), to: ahead(10), status: "approved", reason: "إجازة سنوية", delegateTo: emp["0001"].id, approvedBy: emp["0031"].id } });

  // ── Quality ───────────────────────────────────────────────────────────────
  const inc1 = await db.incident.create({ data: { code: "INC-261018-002", reporterId: emp["0015"].id, patientId: null, type: "needle", severity: "near-miss", description: "وعكة إغماء لمريض أثناء سحب دم — تعامل فوري وفق البروتوكول", status: "closed", anonymous: false, at: ago(2) } });
  const capa1 = await db.capa.create({ data: { code: "CAPA-261018-001", source: "incident", descriptionAr: "تحسين بيئة السحب: قياسات دورية للتسمم وتوفير وجبات خفيفة", actionAr: "إضافة فحص سكر سريع قبل السحب للمرضى المعرضين", ownerId: emp["0012"].id, dueAt: ahead(20), status: "in-progress" } });
  await db.incident.update({ where: { id: inc1.id }, data: { capaId: capa1.id } });
  await db.complaint.create({ data: { code: "CMP-261019-003", patientId: patList[3].id, channel: "web", category: "waiting", description: "انتظار طويل في الأشعة", status: "assigned", assignedTo: emp["0026"].id, slaDueAt: ahead(2) } });
  await db.surveyResponse.createMany({
    data: [
      { patientId: patList[0].id, kind: "visit", score: 5, nps: 10, comment: "استقبال سريع والباركود وفّر وقت", at: ago(6) },
      { patientId: patList[2].id, kind: "home", score: 4, nps: 8, comment: "الفني جاء بالموعد", at: ago(4) },
      { patientId: patList[6].id, kind: "visit", score: 5, nps: 9, comment: "شرح وافٍ من جراحة الثدي", at: ago(3) },
    ],
  });

  // ── Sterilization ─────────────────────────────────────────────────────────
  const set1 = await db.instrumentSet.create({ data: { code: "SET-DENT-01", nameAr: "حقيبة أسنان عامة", nameEn: "General dental set", contents: ["مرآة", "ملقط", "مبرد", "مصة"], status: "sterile" } });
  await db.sterilizationCycle.create({ data: { cycleNo: "ST-261020-01", autoclave: ast["AST-DNT-006"].code, params: { tempC: 134, pressure: 2.1, minutes: 4 }, indicator: "passed", result: "passed", runBy: emp["0012"].id, at: todayAt(7), setIds: [set1.id] } });

  // ── CMS ───────────────────────────────────────────────────────────────────
  const artDefs: [string, string, string, string, string][] = [
    ["vitamin-d-guide", "دليل فيتامين د: متى تفحص وكيف تعالج؟", "Vitamin D guide: when to test and how to treat?", "education", "فيتامين د شائع النقص في الخليج. نفسر القيم الطبيعية ومتى تحتاج مكملات، مع مراجعة طبية موثقة."],
    ["fasting-labs", "الصيام قبل التحاليل: ما يجب معرفته", "Fasting before lab tests: what to know", "education", "أي التحاليل تحتاج صياماً؟ كم ساعة؟ وهل الماء مسموح؟ دليل مبسط بمراجعة طبية."],
    ["breast-awareness", "الوعي بصحة الثدي: الفحص الذاتي خطوة بخطوة", "Breast awareness: self-exam step by step", "awareness", "كيف تلاحظين أي تغير؟ ومتى تراجعين فوراً؟ شرح مبسط بأدلة مراجعة طبياً."],
    ["home-draw-bh", "خدمة السحب المنزلي: التغطية والأسعار", "Home draw service: coverage & pricing", "service", "نغطي جميع محافظات البحرين. جدول الرسوم حسب المنطقة وأوقات الذروة."],
  ];
  for (const [slug, ar, en, cat, body] of artDefs) {
    await db.article.create({ data: { slug, titleAr: ar, titleEn: en, bodyAr: `${body}\n\nمراجعة طبية: د. فاطمة العريض — بتاريخ مراجعة ظاهر.`, bodyEn: `${body}\n\nMedical review: Dr. Fatima — visible review date.`, category: cat, medicalReviewed: true, reviewBy: emp["0001"].id, tags: [cat] } });
  }
  const faqs: [string, string, string, string][] = [
    ["ماذا أحضر معي للزيارة الأولى؟", "What to bring to the first visit?", "بطاقة الهوية (الرقم الشخصي/الخليجية/الجواز) وبطاقة التأمين إن وجدت، والتقارير السابقة.", "Bring your ID (CPR/GCC/passport), insurance card if any, and previous reports."],
    ["هل أحتاج صياماً؟", "Do I need to fast?", "للتحاليل الشاملة وسكر الصائم والدهون: صيام 8-12 ساعة مع مسموحية الماء.", "For comprehensive panels, fasting glucose and lipids: fast 8-12h, water is fine."],
    ["كيف أسجل الحضور؟", "How do I check in?", "بمسح باركود الموعد من هاتفك في الكشك، أو بطاقتك الدائمة، أو إدخال الرقم الشخصي.", "Scan your appointment barcode at the kiosk, your permanent card, or enter CPR."],
    ["ما سياسة الإلغاء؟", "What is the cancellation policy?", "الإلغاء قبل 4 ساعات بدون رسوم. عدم الحضور المتكرر قد يفرض رسوماً.", "Cancel 4h+ before at no charge. Repeated no-shows may incur fees."],
    ["متى تصل نتائجي؟", "When do results arrive?", "تظهر في بوابة المريض فور اعتمادها وفق قواعد الإفراج. عادي خلال 24 ساعة عمل.", "Released to the portal upon approval per release rules. Routine within 24 working hours."],
    ["هل تستقبلون تأميني؟", "Do you accept my insurance?", "نتعامل مع بسمة والخليج وحسابات الشركات. تحقق من الأهلية قبل الزيارة.", "We work with Basma, Gulf and corporate accounts. Verify eligibility before visiting."],
    ["كيف أوثّق مستنداً؟", "How do I verify a document?", "امسح رمز QR في التقرير أو أدخله في صفحة verify.website.bh.", "Scan the QR on the report or enter it on verify.website.bh."],
    ["ما خصوصية السجل النفسي؟", "How is my psych record protected?", "ملاحظات العلاج الخاص لا يطلع عليها غير كاتبها، ووصف الفاتورة محايد.", "Private therapy notes stay sealed; invoice wording is neutral."],
  ];
  for (const [qAr, qEn, aAr, aEn] of faqs) {
    await db.faq.create({ data: { qAr, qEn, aAr, aEn, category: "general" } });
  }
  await db.jobOpening.createMany({
    data: [
      { titleAr: "ممرض/ة فرز", titleEn: "Triage nurse", dept: "GP", descAr: "خبرة سنتين بفرز عيادات خارجية.", descEn: "2y OPD triage experience.", openings: 2 },
      { titleAr: "فني أشعة وسونار", titleEn: "Radiology technologist", dept: "RAD", descAr: "يشترط ترخيص NHRA سارٍ.", descEn: "Active NHRA license required.", openings: 1 },
    ],
  });

  // ── Settings + feature flags + sequences ──────────────────────────────────
  const settings: { key: string; value: unknown; group: string }[] = [
    { key: "facility.nameAr", value: "المركز الطبي — البحرين", group: "identity" },
    { key: "facility.nameEn", value: "Bahrain Medical Center", group: "identity" },
    { key: "facility.vatNo", value: "300012345600003", group: "finance" },
    { key: "finance.vatStandardBp", value: 500, group: "finance" },
    { key: "finance.rounding", value: "half-up-fils", group: "finance" },
    { key: "schedule.reminders", value: [48, 24, 2], group: "schedule" },
    { key: "schedule.lateGraceMin", value: 15, group: "schedule" },
    { key: "queue.agingBoostPer10Min", value: 1, group: "queue" },
    { key: "lab.criticalEscalationMin", value: 10, group: "lab" },
    { key: "reader.agentVersion", value: "1.0.0-sim", group: "reader" },
    { key: "cpr.allowLeadingZero", value: false, group: "identity" },
    { key: "psych.neutralInvoice", value: true, group: "privacy" },
    { key: "release.defaultRule", value: "after-approval", group: "results" },
  ];
  for (const s of settings) {
    await db.setting.create({ data: { key: s.key, value: s.value as object, group: s.group, updatedBy: "emp0028" } });
  }
  await db.featureFlag.createMany({
    data: [
      { key: "telemedicine", enabled: true, description: "الاستشارات عن بعد" },
      { key: "chemo.infusion", enabled: false, description: "الحقن الوريدي للأورام (غير مفعل — يتطلب ترخيصاً)" },
      { key: "peds.growthCharts", enabled: true, description: "مخططات النمو WHO" },
      { key: "ai.assistant", enabled: true, description: "المساعد الذكي الإداري" },
      { key: "whatsapp.channel", enabled: true, description: "واتساب للأعمال (قوالب معتمدة)" },
    ],
  });
  const seqKeys = ["mrn", "encounter", "order", "specimen", "rx", "invoice", "claim", "consent", "fault", "wo", "lot", "hv", "payment", "referral", "preauth", "appt", "incident", "complaint", "emp", "ticket:A", "ticket:B", "ticket:C", "ticket:D", "ticket:E", "ticket:F", "ticket:G", "ticket:H", "mdt", "document"];
  for (const k of seqKeys) {
    await db.numberSequence.upsert({ where: { key: k }, create: { key: k, next: 9001 }, update: { next: 9001 } });
  }

  // ── Notifications sample ──────────────────────────────────────────────────
  await db.notification.createMany({
    data: [
      { userId: emp["0001"].id, role: "doctor", kind: "critical-result", titleAr: "قيمة حرجة: بوتاسيوم 6.9", titleEn: "Critical value: K 6.9", bodyAr: "أكد الاستلام — سلسلة التصعيد نشطة", bodyEn: "Acknowledge — escalation chain active", channel: "inapp", patientId: fatima.id, status: "sent" },
      { userId: emp["0023"].id, role: "maintenance-tech", kind: "wo-assigned", titleAr: "أمر عمل WO-261020-011", titleEn: "Work order WO-261020-011", bodyAr: "بانتظار قطعة المضخة", bodyEn: "Awaiting pump spare", channel: "inapp", status: "sent" },
      { userId: emp["0018"].id, role: "reception", kind: "task", titleAr: "مهمة: الاتصال بمريضة الخزعة", titleEn: "Task: biopsy scheduling call", channel: "inapp", status: "sent" },
    ],
  });

  // audit genesis entry
  await db.auditEvent.create({
    data: {
      action: "seed", resource: "system", actorId: "emp0028", actorRole: "sysadmin",
      reason: "Initial seed", hash: sha256("genesis-seed"), prevHash: "GENESIS",
      after: { patients: patList.length, date: new Date().toISOString() },
    },
  });

  console.log("• billing, consents, documents, home, quality, CMS, settings ✔");
}
