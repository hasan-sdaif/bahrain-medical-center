/**
 * Domain algorithms (spec §17) — queue priority, prescription safety,
 * weight-based dosing, delta check, home routing (NN+2-opt), LMS growth,
 * pre-op gate, recalls, verification. Pure functions (packages/core equivalent).
 */
import { PRIORITY_WEIGHT, REFERRAL_SLA_HOURS, VAT_RULES } from "./types";
import { bpOfFils, type Fils } from "./money";

// ── §17.5 Queue priority ────────────────────────────────────────────────────
export interface QueueCandidate {
  id: string; code: string; patientName: string; priority: string;
  status: string; calledAt: Date | string | null; callCount: number; waitedMin: number;
}
export function queueOrder(c: QueueCandidate): number[] {
  const recalled = c.status === "called" && c.callCount > 0 ? 0 : 1;
  let weight = PRIORITY_WEIGHT[c.priority] ?? 0;
  weight += Math.min(Math.floor(c.waitedMin / 10), 5); // fair aging
  return [recalled, -weight, -c.waitedMin];
}
export function compareQueue(a: QueueCandidate, b: QueueCandidate): number {
  const qa = queueOrder(a); const qb = queueOrder(b);
  for (let i = 0; i < 3; i++) if (qa[i] !== qb[i]) return qa[i] - qb[i];
  return 0;
}

// ── §17.7 Prescription safety ───────────────────────────────────────────────
export interface RxSafetyInput {
  drug: {
    nameEn: string; allergyTags: string[]; interactTags: string[];
    maxDailyMg: number | null; adultMaxDoseMg?: number | null; pregCategory: string;
    controlled: boolean; highAlert: boolean; lookAlike?: string | null;
  };
  doseMg: number;
  patient: {
    ageYears: number; weightKg: number | null; pregnant: boolean;
    allergies: { substance: string }[];
    activeMedications: { nameEn: string; interactTags?: string[] }[];
    renalImpaired: boolean;
  };
}
export interface RxSafetyReport { errors: { code: string; ar: string; en: string }[]; warnings: { code: string; ar: string; en: string }[] }

export function checkPrescriptionSafety(input: RxSafetyInput): RxSafetyReport {
  const errors: RxSafetyReport["errors"] = [];
  const warnings: RxSafetyReport["warnings"] = [];
  const { drug, doseMg, patient } = input;

  for (const a of patient.allergies) {
    const sub = a.substance.toLowerCase();
    if (drug.allergyTags.some((t) => sub.includes(t.toLowerCase()) || t.toLowerCase().includes(sub))) {
      errors.push({ code: "ALLERGY_ALERT", ar: `تعارض حساسية معقّد: ${a.substance}`, en: `Allergy conflict: ${a.substance}` });
    }
  }
  const myTags = new Set(drug.interactTags);
  for (const m of patient.activeMedications) {
    for (const t of m.interactTags ?? []) {
      if (myTags.has(t) && t !== drug.nameEn) {
        errors.push({ code: "INTERACTION_MAJOR", ar: `تفاعل دوائي مع ${m.nameEn}`, en: `Interaction with ${m.nameEn}` });
      }
    }
  }
  if (patient.pregnant && ["C", "D", "X"].includes(drug.pregCategory)) {
    errors.push({ code: "PREGNANCY_CONTRA", ar: "ممنوع في الحمل حسب فئة الدواء", en: "Contraindicated in pregnancy" });
  }
  if (drug.maxDailyMg && doseMg > drug.maxDailyMg) {
    errors.push({ code: "DOSE_EXCEED", ar: `الجرعة ${doseMg} ملغ تتجاوز الحد اليومي ${drug.maxDailyMg} ملغ`, en: `Dose ${doseMg}mg exceeds max ${drug.maxDailyMg}mg/day` });
  }
  if (patient.ageYears < 12 && patient.weightKg) {
    const perKg = doseMg / patient.weightKg;
    if (drug.adultMaxDoseMg && perKg > 15) warnings.push({ code: "PEDI_DOSE_REVIEW", ar: "راجع جرعة الوزن للأطفال (تحقق مزدوج)", en: "Pediatric weight dose — double check" });
  }
  if (patient.renalImpaired) warnings.push({ code: "RENAL_ADJUST", ar: "يحتاج تعديل جرعة حسب وظائف الكلى", en: "Renal adjustment advised" });
  if (drug.highAlert) warnings.push({ code: "HIGH_ALERT_DRUG", ar: "دواء عالي الخطورة — تحقق مزدوج", en: "High-alert drug — double check" });
  if (drug.lookAlike) warnings.push({ code: "LASA", ar: `شبيه بالاسم مع ${drug.lookAlike} (LASA)`, en: `Look-alike with ${drug.lookAlike}` });
  return { errors, warnings };
}

// ── §17.8 Weight-based dose ─────────────────────────────────────────────────
export function weightBasedDose(
  mgPerKgPerDay: number, weightKg: number, dosesPerDay: number,
  opts: { absoluteMaxMg?: number | null; concentrationMgPerMl?: number | null } = {},
): { dailyMg: number; perDoseMg: number; volumeMl: number | null; overLimit: boolean } {
  const dailyMg = Math.round(mgPerKgPerDay * weightKg * 100) / 100;
  const overLimit = opts.absoluteMaxMg ? dailyMg > opts.absoluteMaxMg : false;
  const perDoseMg = Math.round((dailyMg / dosesPerDay) * 100) / 100;
  const volumeMl = opts.concentrationMgPerMl ? Math.round((perDoseMg / opts.concentrationMgPerMl) * 100) / 100 : null;
  return { dailyMg, perDoseMg, volumeMl, overLimit };
}

// ── §17.9 Delta check ───────────────────────────────────────────────────────
export function deltaCheck(value: number, previous: number | null, limitPct: number): { blocked: boolean; deltaPct: number | null } {
  if (previous == null || previous === 0) return { blocked: false, deltaPct: null };
  const deltaPct = Math.round((Math.abs(value - previous) / previous) * 1000) / 10;
  return { blocked: deltaPct > limitPct, deltaPct };
}

// ── §17.10 invoice VAT (BHD, integer fils) ──────────────────────────────────
export interface VatLine { kind: string; isDrug?: boolean; unitFils: Fils; qty: number }
export function computeVatInvoice(lines: VatLine[]): {
  lineResults: { grossFils: Fils; vatFils: Fils; vatBp: number }[];
  subtotalFils: Fils; vatFils: Fils;
} {
  const lineResults = lines.map((l) => {
    const grossFils = l.unitFils * l.qty;
    const vatBp = l.isDrug ? VAT_RULES.drug : (VAT_RULES[l.kind] ?? VAT_RULES.consultation);
    return { grossFils, vatFils: bpOfFils(grossFils, vatBp), vatBp };
  });
  return {
    lineResults,
    subtotalFils: lineResults.reduce((a, b) => a + b.grossFils, 0),
    vatFils: lineResults.reduce((a, b) => a + b.vatFils, 0),
  };
}

// ── §17.11 Home visit routing (Nearest Neighbor + 2-opt) ────────────────────
export interface RoutableVisit { id: string; lat: number; lng: number; fasting: boolean; addr: string }
export interface PlannedRoute { order: RoutableVisit[]; totalKm: number; etasMin: number[]; warnings: string[] }

/** Approx distance km (Bahrain is tiny; equirectangular is fine). */
function distKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const x = (b.lng - a.lng) * 50.0; // ~50km/deg at 26N
  const y = (b.lat - a.lat) * 110.9;
  return Math.sqrt(x * x + y * y);
}

export function planRoute(visits: RoutableVisit[], depot: { lat: number; lng: number }, avgKmh = 30, serviceMin = 15): PlannedRoute {
  const warnings: string[] = [];
  if (visits.length === 0) return { order: [], totalKm: 0, etasMin: [], warnings };
  // Nearest neighbor from depot
  const remaining = [...visits];
  const order: RoutableVisit[] = [];
  let cur = depot as { lat: number; lng: number };
  while (remaining.length) {
    let best = 0; let bestD = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = distKm(cur, remaining[i]);
      if (d < bestD) { bestD = d; best = i; }
    }
    const v = remaining.splice(best, 1)[0];
    order.push(v);
    cur = v;
  }
  // Fasting first (before 10:00) — stable reordering preserving cluster order
  const fasting = order.filter((v) => v.fasting);
  const others = order.filter((v) => !v.fasting);
  const seq = [...fasting, ...others];
  // 2-opt
  const n = seq.length;
  const pts = [depot, ...seq];
  const d = (i: number, j: number) => distKm(pts[i], pts[j]);
  let improved = true;
  let guard = 0;
  while (improved && guard++ < 30) {
    improved = false;
    for (let i = 1; i < n; i++) {
      for (let j = i + 1; j <= n; j++) {
        const before = d(i - 1, i) + (j < n ? d(j, j + 1) : 0);
        const after = d(i - 1, j) + (j < n ? d(i, j + 1) : 0);
        if (after < before - 1e-6) {
          pts.splice(i, j - i + 1, ...pts.slice(i, j + 1).reverse());
          improved = true;
        }
      }
    }
  }
  const finalOrder = pts.slice(1) as RoutableVisit[];
  // metrics
  let km = distKm(depot, finalOrder[0]);
  for (let i = 1; i < finalOrder.length; i++) km += distKm(finalOrder[i - 1], finalOrder[i]);
  const etas: number[] = [];
  let t = 0;
  for (let i = 0; i < finalOrder.length; i++) {
    const leg = i === 0 ? distKm(depot, finalOrder[i]) : distKm(finalOrder[i - 1], finalOrder[i]);
    t += (leg / avgKmh) * 60 + (i > 0 ? serviceMin : 0);
    etas.push(Math.round(t));
    if (t > 120) warnings.push(`SMP_TRANSPORT_LIMIT: ${finalOrder[i].addr}`);
  }
  if (finalOrder.some((v) => v.fasting)) warnings.push("FASTING_FIRST_OK");
  return { order: finalOrder, totalKm: Math.round(km * 10) / 10, etasMin: etas, warnings };
}

// ── §17.12 LMS growth percentiles ───────────────────────────────────────────
/** WHO-style LMS reference points (0..60 months). [تحقق] — replace with official WHO tables. */
export const WHO_LMS: Record<string, Record<"boy" | "girl", { age: number; L: number; M: number; S: number }[]>> = {
  weight: {
    boy: [
      { age: 0, L: 0.35, M: 3.3, S: 0.14 }, { age: 3, L: 0.35, M: 6.4, S: 0.13 }, { age: 6, L: 0.3, M: 7.9, S: 0.12 },
      { age: 12, L: 0.2, M: 9.6, S: 0.11 }, { age: 24, L: 0.1, M: 12.2, S: 0.11 }, { age: 36, L: 0.05, M: 14.3, S: 0.11 },
      { age: 48, L: 0.03, M: 16.3, S: 0.11 }, { age: 60, L: 0.02, M: 18.3, S: 0.12 },
    ],
    girl: [
      { age: 0, L: 0.35, M: 3.2, S: 0.14 }, { age: 3, L: 0.35, M: 5.8, S: 0.13 }, { age: 6, L: 0.3, M: 7.3, S: 0.12 },
      { age: 12, L: 0.2, M: 8.9, S: 0.11 }, { age: 24, L: 0.1, M: 11.5, S: 0.11 }, { age: 36, L: 0.05, M: 13.9, S: 0.11 },
      { age: 48, L: 0.03, M: 16.1, S: 0.12 }, { age: 60, L: 0.02, M: 18.2, S: 0.13 },
    ],
  },
  height: {
    boy: [
      { age: 0, L: 0.9, M: 49.9, S: 0.04 }, { age: 6, L: 0.7, M: 67.6, S: 0.04 }, { age: 12, L: 0.6, M: 75.7, S: 0.04 },
      { age: 24, L: 0.45, M: 87.1, S: 0.04 }, { age: 36, L: 0.35, M: 96.1, S: 0.04 }, { age: 48, L: 0.3, M: 103.3, S: 0.04 },
      { age: 60, L: 0.25, M: 110.0, S: 0.04 },
    ],
    girl: [
      { age: 0, L: 0.9, M: 49.1, S: 0.04 }, { age: 6, L: 0.7, M: 65.7, S: 0.04 }, { age: 12, L: 0.6, M: 74.0, S: 0.04 },
      { age: 24, L: 0.45, M: 85.7, S: 0.04 }, { age: 36, L: 0.35, M: 95.1, S: 0.04 }, { age: 48, L: 0.3, M: 102.7, S: 0.04 },
      { age: 60, L: 0.25, M: 109.4, S: 0.04 },
    ],
  },
  head: {
    boy: [
      { age: 0, L: 1.0, M: 34.5, S: 0.04 }, { age: 6, L: 0.8, M: 44.2, S: 0.04 }, { age: 12, L: 0.6, M: 46.5, S: 0.04 },
      { age: 24, L: 0.5, M: 48.9, S: 0.04 }, { age: 36, L: 0.4, M: 50.5, S: 0.04 }, { age: 60, L: 0.35, M: 52.0, S: 0.04 },
    ],
    girl: [
      { age: 0, L: 1.0, M: 34.0, S: 0.04 }, { age: 6, L: 0.8, M: 43.0, S: 0.04 }, { age: 12, L: 0.6, M: 45.3, S: 0.04 },
      { age: 24, L: 0.5, M: 47.9, S: 0.04 }, { age: 36, L: 0.4, M: 49.5, S: 0.04 }, { age: 60, L: 0.35, M: 51.0, S: 0.04 },
    ],
  },
};

function lerp(a: number, b: number, t: number): number { return a + (b - a) * t; }
function erf(x: number): number {
  const s = x < 0 ? -1 : 1;
  x = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return s * y;
}
export function normalCdf(z: number): number { return 0.5 * (1 + erf(z / Math.SQRT2)); }

export function growthPercentile(
  metric: "weight" | "height" | "head", value: number, ageMonths: number, sex: "male" | "female",
  gestationalAgeAtBirthWeeks = 40,
): { z: number; percentile: number; flag: string | null } {
  let m = ageMonths;
  if (gestationalAgeAtBirthWeeks < 37 && ageMonths <= 24) {
    m = Math.max(0, ageMonths - (40 - gestationalAgeAtBirthWeeks) / 4.345);
  }
  const table = WHO_LMS[metric][sex === "male" ? "boy" : "girl"];
  let ref = table[0];
  for (let i = 0; i < table.length; i++) {
    if (m <= table[i].age) { ref = table[i]; break; }
    ref = table[i];
  }
  const { L, M, S } = ref;
  let z: number;
  if (L === 0) z = (Math.log(value / M)) / S;
  else z = (Math.pow(value / M, L) - 1) / (L * S);
  z = Math.round(z * 100) / 100;
  const percentile = Math.round(normalCdf(z) * 1000) / 10;
  const flag = z < -3 || z > 3 ? (z < -3 ? "very-low" : "very-high") : z < -2 || z > 2 ? "out-of-range" : null;
  return { z, percentile, flag };
}

// ── §17.13 verify code check ────────────────────────────────────────────────
export function verifyCodeOk(code: string): boolean {
  return /^BMC-[A-Z0-9]{22}$/.test(code);
}

// ── §17.14 pre-op readiness gate ────────────────────────────────────────────
export interface PreOpChecklist {
  labsComplete: boolean; clearances: boolean; consents: boolean;
  fastingAck: boolean; paymentOk: boolean; materialsOk: boolean;
}
export function preOpGate(c: PreOpChecklist): { ready: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!c.labsComplete) missing.push("labs");
  if (!c.clearances) missing.push("clearances");
  if (!c.consents) missing.push("consents");
  if (!c.fastingAck) missing.push("fasting");
  if (!c.paymentOk) missing.push("payment");
  if (!c.materialsOk) missing.push("materials");
  return { ready: missing.length === 0, missing };
}

// ── Referral SLA due-at ─────────────────────────────────────────────────────
export function referralDueAt(urgency: string, from: Date = new Date()): Date {
  const hours = REFERRAL_SLA_HOURS[urgency] ?? 72;
  return new Date(from.getTime() + hours * 3600000);
}

// ── Autoverification decision (§17.9) ───────────────────────────────────────
export function autoVerifyDecision(args: {
  qcPassed: boolean; flag: string | null; deltaBlocked: boolean; autoVerifyEnabled: boolean;
}): { autoVerified: boolean; needsHuman: boolean; reason: string } {
  if (!args.qcPassed) return { autoVerified: false, needsHuman: true, reason: "QC_FAILED" };
  if (args.flag === "CRIT") return { autoVerified: false, needsHuman: true, reason: "CRITICAL_VALUE" };
  if (args.deltaBlocked) return { autoVerified: false, needsHuman: true, reason: "DELTA_CHECK" };
  if (args.flag && args.flag !== "normal") return { autoVerified: false, needsHuman: true, reason: `FLAG_${args.flag}` };
  if (!args.autoVerifyEnabled) return { autoVerified: false, needsHuman: true, reason: "AUTOVERIFY_OFF" };
  return { autoVerified: true, needsHuman: false, reason: "OK" };
}

// ── Ref range by age/sex/pregnancy ──────────────────────────────────────────
export interface RefRangeTable { male?: { low: number; high: number }; female?: { low: number; high: number }; femalePregnant?: { low: number; high: number }; child?: { low: number; high: number } }
export function refRangeFor(
  table: RefRangeTable, ageYears: number, sex: "male" | "female", pregnant: boolean,
): { low: number; high: number } | null {
  if (ageYears < 13 && table.child) return table.child;
  if (sex === "female" && pregnant && table.femalePregnant) return table.femalePregnant;
  const t = sex === "male" ? (table.male ?? table.female) : (table.female ?? table.male);
  return t ?? null;
}

export function flagFor(value: number, range: { low: number; high: number } | null, critical: { low?: number; high?: number } | null): string | null {
  if (critical && ((critical.high != null && value >= critical.high) || (critical.low != null && value <= critical.low))) return "CRIT";
  if (!range) return "normal";
  if (value > range.high) return "H";
  if (value < range.low) return "L";
  return "normal";
}

// eGFR (CKD-EPI simplified) & LDL (Friedewald)
export function calcEgfr(creatinineMgDl: number, ageYears: number, sex: "male" | "female"): number {
  const k = sex === "female" ? (creatinineMgDl < 0.7 ? 0.7 : 1.0) : (creatinineMgDl < 0.9 ? 0.9 : 1.0);
  const a = sex === "female" ? (creatinineMgDl < 0.7 ? -0.241 : -0.302) : (creatinineMgDl < 0.9 ? -0.302 : -0.302);
  const e = sex === "female" ? 1.012 : 1.0;
  const base = 142 * Math.pow(Math.min(creatinineMgDl / k, 1), a) * Math.pow(Math.max(creatinineMgDl / k, 1), -1.2) * e * Math.pow(0.9938, ageYears);
  return Math.round(base);
}
export function calcLdl(total: number, hdl: number, tg: number): number | null {
  if (tg > 4.5) return null;
  return Math.round((total - hdl - tg / 2.2) * 10) / 10;
}
