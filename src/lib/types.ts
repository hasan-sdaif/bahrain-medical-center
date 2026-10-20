/**
 * Domain type unions — single source of truth for status/type vocabularies.
 * (No DB enums: SQLite-safe, validated here + Zod at API edge. ADR-002.)
 */
export type Lang = "ar" | "en";

export const STAFF_ROLES = [
  "reception","callcenter","nurse","doctor","dentist","surgeon","oncologist",
  "psychiatrist","nutritionist","pediatrician","lab-tech","phlebotomist","radiologist",
  "pharmacist","cashier","insurance","collector","inventory","maintenance-tech",
  "maintenance-sup","hr","quality","dpo","auditor","sysadmin","content",
  "center-manager","med-director","dept-head",
] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const DEPT_CODES = ["GP","DENT","SURG","ENDO","BREAST","URO","ONCO","NUTR","PED","PSY"] as const;
export type DeptCode = (typeof DEPT_CODES)[number];

export const GOVERNORATES = [
  { code: "capital", ar: "العاصمة", en: "Capital", feeFils: 3000, morningFils: 0, eveningFils: 1500, holidayFils: 2000 },
  { code: "muharraq", ar: "المحرق", en: "Muharraq", feeFils: 3500, morningFils: 0, eveningFils: 1500, holidayFils: 2500 },
  { code: "northern", ar: "الشمالية", en: "Northern", feeFils: 4500, morningFils: 0, eveningFils: 2000, holidayFils: 3000 },
  { code: "southern", ar: "الجنوبية", en: "Southern", feeFils: 5000, morningFils: 0, eveningFils: 2000, holidayFils: 3000 },
] as const;
export type GovernorateCode = (typeof GOVERNORATES)[number]["code"];

export const APPT_STATUS = ["requested","confirmed","arrived","in-service","completed","cancelled","no-show","rescheduled"] as const;
export const ENC_STATUS = ["scheduled","arrived","triage","awaiting-doctor","in-exam","awaiting-results","exam-done","billing","closed","cancelled","no-show","left-early"] as const;
export const ORDER_STATUS = ["draft","signed","received","in-progress","completed","reported","cancelled","rejected"] as const;
export const SPECIMEN_STATUS = ["pending","drawn","in-transit","received","analyzing","analyzed","stored","destroyed","rejected"] as const;
export const RESULT_FLAG = ["normal","H","L","CRIT"] as const;
export const RX_STATUS = ["draft","signed","pharmacy-review","preparing","dispensed","partial","cancelled"] as const;
export const INVOICE_STATUS = ["draft","issued","partial","paid","void","credit-note"] as const;
export const CLAIM_STATUS = ["prepared","submitted","accepted","partial-paid","paid","rejected","resubmitted"] as const;
export const PREAUTH_STATUS = ["requested","submitted","approved","rejected","expired"] as const;
export const CONSENT_STATUS = ["active","withdrawn","expired"] as const;
export const REFERRAL_STATUS = ["draft","sent","received","accepted","rejected","needs-info","scheduled","seen","closed"] as const;
export const TICKET_STATUS = ["issued","waiting","called","serving","done","no-show","redirected"] as const;
export const TICKET_PRIORITY = ["emergency","elderly","disabled","pregnant","child","normal"] as const;
export const HOME_STATUS = ["requested","confirmed","assigned","on-the-way","arrived","drawn","to-lab","delivered","failed","cancelled"] as const;
export const FR_STATUS = ["new","classified","assigned","fixing","awaiting-part","done","closed","cancelled"] as const;
export const WO_STATUS = ["open","assigned","in-progress","awaiting-part","done","closed","deferred"] as const;
export const ASSET_STATUS = ["operational","down","in-maintenance","awaiting-calibration","retired"] as const;
export const PAYMENT_METHODS = ["cash","card","benefit","transfer","insurance","wallet","package"] as const;

export const CONSENT_KINDS = [
  "treatment","privacy","data-sharing","marketing","clinical-photo","surgery","anesthesia",
  "transfusion","chemo","psy","tele","home-draw","third-party-delivery","research",
  "refusal","financial","receipt","delegation","guardian",
] as const;
export type ConsentKind = (typeof CONSENT_KINDS)[number];

export const ID_TYPES = ["CPR","GCC_ID","PASSPORT","TMP"] as const;
export type IdType = (typeof ID_TYPES)[number];

export const GCC_ID_RULES: Record<string, { pattern: string; length: number; noteAr: string; noteEn: string }> = {
  SA: { pattern: "[0-9]{10}", length: 10, noteAr: "الهوية السعودية 10 أرقام", noteEn: "Saudi ID 10 digits" },
  AE: { pattern: "[0-9]{15}", length: 15, noteAr: "الإمارات 15 رقمًا (يشمل 784)", noteEn: "UAE 15 digits (784 prefix)" },
  KW: { pattern: "[0-9]{12}", length: 12, noteAr: "المدني الكويتي 12 رقمًا", noteEn: "Kuwait Civil ID 12 digits" },
  QA: { pattern: "[0-9]{11}", length: 11, noteAr: "قطر 11 رقمًا", noteEn: "Qatar 11 digits" },
  OM: { pattern: "[0-9]{8}", length: 8, noteAr: "عمان 8 أرقام", noteEn: "Oman 8 digits" },
};

export const VAT_BP = { standard: 500, zero: 0, exempt: 0 } as const; // basis points of % (5% = 500)
export const VAT_RULES: Record<string, number> = {
  consultation: VAT_BP.standard,
  lab: VAT_BP.standard,
  imaging: VAT_BP.standard,
  dental: VAT_BP.standard,
  procedure: VAT_BP.standard,
  home: VAT_BP.standard,
  drug: VAT_BP.zero,       // الأدوية: معالجة خاصة — صفر/معفى [تحقق]
  package: VAT_BP.standard,
};

export const PRIORITY_WEIGHT: Record<string, number> = {
  emergency: 100, elderly: 40, disabled: 40, pregnant: 30, child: 20, normal: 0,
};

export interface Bilingual { ar: string; en: string }

export interface BahrainAddress {
  governorate?: string; area?: string; block?: string; road?: string;
  building?: string; flat?: string; notes?: string; lat?: number; lng?: number;
}

/** Priority order for check-in rules */
export const CHECKIN_EARLY_MIN = 20;
export const CHECKIN_LATE_MIN = 15;

export const SERVICE_POINT_KINDS = ["reception","triage","clinic","phlebotomy","lab","radiology","pharmacy","cashier"] as const;

export const REFERRAL_SLA_HOURS: Record<string, number> = { emergent: 2, urgent: 24, routine: 72 };
