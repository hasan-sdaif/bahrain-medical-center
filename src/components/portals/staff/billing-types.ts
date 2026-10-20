/**
 * Billing/home shared types, constants & helpers (agent 2-e).
 * Money = integer fils everywhere; BHD text inputs convert via FILS().
 */
import type { Lang } from "@/i18n";

export interface PickedPatient {
  id: string;
  mrn: string;
  nameAr: string;
  nameEn?: string | null;
  phone?: string | null;
}

export type LineKind = "consultation" | "lab" | "imaging" | "drug" | "consent" | "home";

export interface LineDraft {
  kind: LineKind;
  nameAr: string;
  nameEn: string;
  unitBhd: string; // text input in BHD
  qty: number;
  isDrug: boolean;
}

export interface InvoiceLine {
  kind: string;
  nameAr: string;
  nameEn: string;
  qty: number;
  unitFils: number;
  vatBp: number;
  grossFils: number;
  vatFils: number;
}

export interface SessionInvoice {
  id: string;
  code: string;
  patientId: string;
  patientName: string;
  status: "draft" | "issued" | "partial" | "paid";
  subtotalFils: number;
  vatFils: number;
  discountFils: number;
  totalFils: number;
  patientFils: number;
  insurerFils: number;
  capped: boolean;
  isQuotation: boolean;
  claimCode?: string;
  lines: InvoiceLine[];
}

export interface SessionPayment {
  id: string;
  code: string;
  invoiceCode: string;
  method: "cash" | "card" | "benefit";
  amountFils: number;
  at: string; // ISO
  receiptQr: string;
}

export interface CloseShiftResult {
  expectedFils: number;
  countedFils: number;
  difference: number;
  methods: Record<string, number>;
}

export const PAYERS: { code: string; ar: string; en: string }[] = [
  { code: "BH-ASSUR", ar: "بسمة — التأمين الصحية", en: "Basma Health Insurance" },
  { code: "GULF-MED", ar: "الخليج للتأمين الطبي", en: "Gulf Medical Insurance" },
  { code: "CORP-OIL", ar: "شركة نفط البحرين (حساب شركة)", en: "Bapco (corporate account)" },
];

/** Seeded reference invoices (display-only — no interactive db id client-side). */
export const SEEDED_INVOICES: { code: string; status: "paid" | "issued"; patient: string; subtotalFils: number; vatFils: number; totalFils: number; patientFils: number; insurerFils: number; noteAr: string; noteEn: string }[] = [
  {
    code: "INV-2026-004512", status: "paid", patient: "أحمد الخالدي",
    subtotalFils: 35000, vatFils: 1750, totalFils: 36750, patientFils: 36750, insurerFils: 0,
    noteAr: "مدفوعة عبر بنفت — سند PAY-2026-006201", noteEn: "Paid via Benefit — receipt PAY-2026-006201",
  },
  {
    code: "INV-2026-004513", status: "issued", patient: "أمل الشماسي",
    subtotalFils: 43000, vatFils: 2150, totalFils: 45150, patientFils: 9030, insurerFils: 36120,
    noteAr: "قيد التحصيل — تقسيم تأمين الخليج (دفع مشاركة 20%)", noteEn: "Awaiting collection — Gulf-Med split (20% coinsurance)",
  },
];

export const newIdemKey = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `key-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

/** Extract bilingual problem+json detail from an api-client error. */
export function problemDetail(err: unknown, lang: Lang): string {
  const e = err as { problem?: Record<string, unknown>; message?: string };
  if (e?.problem) {
    const p = e.problem;
    const detail = lang === "ar" ? p.detailAr : p.detailEn;
    return String(detail ?? p.title ?? p.code ?? "");
  }
  return e?.message ?? "";
}

export const K = (lang: Lang, kind: string): string =>
  lang === "ar"
    ? ({ consultation: "استشارة", lab: "مختبر", imaging: "أشعة", drug: "دواء", consent: "موافقة", home: "سحب منزلي" } as Record<string, string>)[kind] ?? kind
    : kind;
