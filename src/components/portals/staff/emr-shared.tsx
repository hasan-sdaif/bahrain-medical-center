"use client";
/**
 * emr-shared — types + micro-helpers shared by reception/emr screens (agent 2-c).
 * No default exports here; named only.
 */
import { useEffect, useState, type ReactNode } from "react";
import { useI18n } from "@/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

// ── API shapes ─────────────────────────────────────────────────────────────
export interface PatientLite {
  id: string; mrn: string; nameAr: string; nameEn?: string | null;
  dob?: string; phone?: string | null; assurance?: number; idMasked?: string;
}
export interface BoardRow {
  id: string; code: string; start: string; end: string; status: string; channel: string;
  patient: PatientLite;
  doctor: { id: string; nameAr: string; nameEn: string } | null;
  dept: { code: string; nameAr: string; nameEn: string; color: string };
  type: { code: string; nameAr: string; nameEn: string };
  paymentStatus: string; priceFils: number;
}
export interface QueueRow {
  id: string; code: string; status: string; priority: string; waitedMin: number; callCount: number;
  patient: { id: string; mrn: string; nameAr: string; nameEn?: string | null };
  weight: number;
}
export interface SearchResp {
  exact: (PatientLite & { score?: number })[];
  similar: (PatientLite & { score: number })[];
}
export interface ChipRecord {
  idType: string; idNumber: string; issuingCountry: string;
  fullNameAr: string; fullNameEn: string;
  namePartsAr: { first: string; father: string; family: string };
  dob: string; gender: string; nationality: string;
  address: { governorate: string; area: string; block: string };
  phone: string; authenticity: string; readAt: string;
}
export interface ReaderResp { existing: { id: string; mrn: string; nameAr: string; assurance: number } | null; record: ChipRecord }
export interface RegisterResp { id: string; mrn: string; nameAr: string; duplicateWarnings: { id: string; mrn: string; nameAr: string; score: number }[] }
export interface CheckinResp { appointment: { id: string; status: string }; encounter: { id: string; code: string }; ticket: { code: string; priority: string } }
export interface SlotRow { doctorId: string; doctorNameAr: string; at: string; typeCode: string; typeAr: string; typeEn: string; priceFils: number }
export interface OrderRow {
  id: string; code: string; kind: string; priority: string; status: string; reason: string | null;
  patient: { id: string; mrn: string; nameAr: string };
  items: { id: string; nameAr: string; nameEn: string; status: string; priceFils: number }[];
  totalFils: number; createdAt: string;
}
export interface EncounterRow {
  id: string; code: string; status: string; type: string;
  chief: string | null; hpi: string | null; exam: string | null; assessment: string | null;
  plan: string | null; instructionsAr: string | null; instructionsEn: string | null;
  startedAt: string; closedAt: string | null; signedAt: string | null; followUpAt: string | null;
}
export interface VitalsRow {
  id: string; tempC: number | null; pulse: number | null; resp: number | null;
  bpSys: number | null; bpDia: number | null; spo2: number | null;
  weightKg: number | null; heightCm: number | null; waistCm: number | null;
  bmi: number | null; recordedAt: string; note: string | null;
}
export interface ChartData {
  banner: {
    id: string; mrn: string; nameAr: string; nameEn: string | null; age: number; dob: string;
    gender: string; assurance: number; phone: string | null; bloodType: string | null;
    idMasked: string; flags: { kind: string; valueAr?: string | null; valueEn?: string | null; severity?: string | null }[];
    insurance: { payerAr: string; membershipNo: string; copayFils: number; coinsPct: number } | null;
    restricted: boolean;
  };
  clinical: {
    problems: { id: string; icd10: string; nameAr: string; nameEn: string; status: string }[];
    allergies: { id: string; substance: string; reaction: string | null; severity: string }[];
    meds: { id: string; nameAr: string; nameEn: string; dose: string | null; status: string }[];
    imms: { id: string; vaccine: string; doseLabel: string; givenAt: string }[];
    growth: { id: string; metric: string; value: number; ageMonths: number; z: number | null; percentile: number | null }[];
    encounters: EncounterRow[];
    vitals: VitalsRow[];
  } | null;
  adminOnly: { problems: number; encounters: number; noteAr: string } | null;
}
export interface InboxData {
  tasks: { id: string; titleAr: string; priority: string; dueAt: string | null; kind: string; patient: { mrn: string; nameAr: string } | null }[];
  notifications: { id: string; kind: string; titleAr: string; titleEn: string; bodyAr: string | null; bodyEn: string | null; at: string }[];
  threads: { id: string; subjectAr: string; category: string; lastAt: string }[];
}

// ── Hard catalogs (demo pickers) ───────────────────────────────────────────
export const PAYERS = [
  { id: "BH-ASSUR", ar: "بسمة — التأمين الصحية", en: "Basma Health Insurance", copayFils: 5000, coinsPct: 10 },
  { id: "GULF-MED", ar: "الخليج للتأمين الطبي", en: "Gulf Medical Insurance", copayFils: 3000, coinsPct: 20 },
  { id: "CORP-OIL", ar: "شركة نفط البحرين (حساب شركة)", en: "Bapco (corporate)", copayFils: 2000, coinsPct: 0 },
];
export const LAB_CATALOG = [
  { code: "CBC", ar: "تعداد دم كامل", en: "CBC" },
  { code: "HGB", ar: "هيموغلوبين", en: "Hemoglobin" },
  { code: "GLU-F", ar: "سكر صائم", en: "Fasting glucose" },
  { code: "HBA1C", ar: "سكر تراكمي", en: "HbA1c" },
  { code: "K", ar: "بوتاسيوم", en: "Potassium" },
  { code: "NA", ar: "صوديوم", en: "Sodium" },
  { code: "CREA", ar: "كرياتينين", en: "Creatinine" },
  { code: "CHOL", ar: "كوليسترول كلي", en: "Cholesterol" },
  { code: "TSH", ar: "هرمون درقية TSH", en: "TSH" },
  { code: "FT4", ar: "T4 حر", en: "Free T4" },
  { code: "VITD", ar: "فيتامين د", en: "Vitamin D" },
  { code: "PSA", ar: "مستضد بروستاتا", en: "PSA" },
];
export const IMAGING_CATALOG = [
  { code: "US-ABD", ar: "سونار بطن عام", en: "Abdominal US" },
  { code: "US-NECK", ar: "سونار رقبة ودرقية", en: "Neck/thyroid US" },
  { code: "US-BREAST", ar: "سونار ثدي", en: "Breast US" },
  { code: "DXR-PA", ar: "أشعة صدر", en: "Chest X-ray" },
];
export const DRUG_CATALOG = [
  { code: "PARA", ar: "باراسيتامول", en: "Paracetamol", strength: "500mg", maxDailyMg: 4000 },
  { code: "AMOX", ar: "أموكسيسيلين", en: "Amoxicillin", strength: "500mg", maxDailyMg: 3000 },
  { code: "AMOX-CLAV", ar: "أموكسيسيلين/كلافيولانيك", en: "Co-amoxiclav", strength: "625mg", maxDailyMg: 6000 },
  { code: "METF", ar: "متفورمين", en: "Metformin", strength: "500mg", maxDailyMg: 2550 },
  { code: "ATV", ar: "أتورفاستاتين", en: "Atorvastatin", strength: "20mg", maxDailyMg: 80 },
  { code: "OMEP", ar: "أوميبرازول", en: "Omeprazole", strength: "20mg", maxDailyMg: 40 },
  { code: "LEVO-TX", ar: "ليفوتيروكسين", en: "Levothyroxine", strength: "50mcg", maxDailyMg: 200 },
  { code: "INS-R", ar: "إنسولين سريع", en: "Rapid insulin", strength: "100IU/ml", maxDailyMg: 0 },
  { code: "WARF", ar: "وارفارين", en: "Warfarin", strength: "5mg", maxDailyMg: 10 },
  { code: "ASPIRIN", ar: "أسبرين", en: "Aspirin", strength: "81mg", maxDailyMg: 0 },
  { code: "IBU", ar: "إيبوبروفين", en: "Ibuprofen", strength: "400mg", maxDailyMg: 2400 },
  { code: "IRON", ar: "حديد فوماريت", en: "Ferrous fumarate", strength: "200mg", maxDailyMg: 600 },
];
export const DEPARTMENTS = [
  { code: "GP", ar: "الطب العام وطب الأسرة", en: "General Practice" },
  { code: "DENT", ar: "طب الأسنان", en: "Dentistry" },
  { code: "SURG", ar: "الجراحة العامة", en: "General Surgery" },
  { code: "ENDO", ar: "جراحات الغدد الصماء", en: "Endocrine Surgery" },
  { code: "BREAST", ar: "جراحة الثدي والترميم", en: "Breast Surgery" },
  { code: "URO", ar: "المسالك البولية", en: "Urology" },
  { code: "ONCO", ar: "الأورام", en: "Oncology" },
  { code: "NUTR", ar: "التغذية العلاجية", en: "Clinical Nutrition" },
  { code: "PED", ar: "طب الأطفال", en: "Pediatrics" },
  { code: "PSY", ar: "الاختصاص النفسي", en: "Psychiatry" },
];
export const SERVICE_POINTS = [
  { letter: "A", ar: "الاستقبال", en: "Reception" },
  { letter: "B", ar: "الفرز التمريضي", en: "Triage" },
  { letter: "C", ar: "عيادة الطبيب", en: "Clinic" },
  { letter: "D", ar: "سحب الدم", en: "Phlebotomy" },
  { letter: "E", ar: "المختبر", en: "Lab" },
  { letter: "F", ar: "الأشعة", en: "Radiology" },
  { letter: "G", ar: "الصيدلية", en: "Pharmacy" },
  { letter: "H", ar: "الصندوق", en: "Cashier" },
];
export const PRIORITY_OPTIONS = ["normal", "elderly", "disabled", "pregnant", "child", "emergency"] as const;
export const SIGN_ROLES = new Set(["doctor", "dentist", "surgeon", "oncologist", "psychiatrist", "nutritionist", "pediatrician"]);
export const RX_ROLES = new Set(["doctor", "dentist", "surgeon", "psychiatrist", "pediatrician", "med-director"]);

// ── error → bilingual message ──────────────────────────────────────────────
export function errText(e: unknown, lang: "ar" | "en"): string {
  const p = (e as { problem?: Record<string, unknown> })?.problem;
  if (p) return String(lang === "ar" ? (p.detailAr as string) ?? p.detail ?? p.title : (p.detailEn as string) ?? p.detail ?? p.title);
  return e instanceof Error ? e.message : String(e ?? "");
}

// ── last-patient handoff (reception → EMR) via sessionStorage ─────────────
export interface LastPatient { id: string; mrn: string; nameAr: string }
const LP_KEY = "bmc-last-patient";
export function setLastPatient(p: LastPatient) { try { sessionStorage.setItem(LP_KEY, JSON.stringify(p)); } catch { /* private mode */ } }
export function getLastPatient(): LastPatient | null {
  try { const raw = sessionStorage.getItem(LP_KEY); return raw ? (JSON.parse(raw) as LastPatient) : null; } catch { return null; }
}
export function clearLastPatient() { try { sessionStorage.removeItem(LP_KEY); } catch { /* noop */ } }

// ── print helper — isolates one element on paper (no other-file edits) ────
export function printElement(el: HTMLElement | null) {
  if (!el) return;
  const clone = el.cloneNode(true) as HTMLElement;
  clone.id = "bmc-print-clone";
  clone.classList.add("print-area");
  document.body.appendChild(clone);
  document.body.classList.add("bmc-printing");
  const cleanup = () => {
    document.body.classList.remove("bmc-printing");
    clone.remove();
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);
  window.print();
}
export function PrintStyle() {
  return <style>{`@media print { body.bmc-printing > *:not(#bmc-print-clone) { display: none !important; } #bmc-print-clone { position: fixed; inset: 0; background: white; padding: 24px; } }`}</style>;
}

// ── micro components ───────────────────────────────────────────────────────
export function Empty({ label, className }: { label: string; className?: string }) {
  return <div className={cn("grid place-items-center rounded-lg border border-dashed p-8 text-sm text-muted-foreground", className)}>{label}</div>;
}
export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { t } = useI18n();
  return (
    <div role="alert" className="rounded-lg border border-destructive/40 bg-red-50 dark:bg-red-950/40 p-4 text-sm text-red-800 dark:text-red-200 flex items-center gap-3 flex-wrap">
      <span className="flex-1 min-w-40 flex items-center gap-2"><TriangleAlert className="size-4 shrink-0" aria-hidden />{message}</span>
      {onRetry && <Button size="sm" variant="outline" onClick={onRetry}>{t("common.retry")}</Button>}
    </div>
  );
}
export function LoadingRows({ n = 4, h = "h-10" }: { n?: number; h?: string }) {
  return <div className="grid gap-2">{Array.from({ length: n }).map((_, i) => <Skeleton key={i} className={cn(h, "w-full")} />)}</div>;
}
export function Section({ title, children, actions, className }: { title: ReactNode; children: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <Card className={cn("gap-3", className)}>
      <CardHeader className="py-3 px-4">
        <CardTitle className="text-sm flex items-center gap-2">{title}{actions && <span className="ms-auto flex gap-2">{actions}</span>}</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0">{children}</CardContent>
    </Card>
  );
}
export function AssuranceDot({ level }: { level: number | undefined }) {
  const tone = level === 1 ? "bg-emerald-500" : level === 2 ? "bg-teal-500" : level === 4 ? "bg-zinc-400" : "bg-amber-500";
  return <span aria-hidden className={cn("inline-block size-2 rounded-full", tone)} />;
}

// ── small hook: sessionStorage-synced last patient ────────────────────────
export function useLastPatient(): [LastPatient | null, (p: LastPatient | null) => void] {
  const [p, setP] = useState<LastPatient | null>(null);
  useEffect(() => { setP(getLastPatient()); }, []);
  const update = (v: LastPatient | null) => { if (v) setLastPatient(v); else clearLastPatient(); setP(v); };
  return [p, update];
}
