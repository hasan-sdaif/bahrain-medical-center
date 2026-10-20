/**
 * Patient portal shared — API payload types, fetch hook, bilingual error text.
 * (Plain module: no JSX, no server imports.)
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n, type Lang } from "@/i18n";

// ── payload types (mirror src/server/patient.ts + public.ts) ────────────────
export interface LoginOption { id: string; mrn: string; nameAr: string; nameEn: string; phone: string }
export interface PatientFlag { kind: string; valueAr?: string | null; valueEn?: string | null; severity?: string | null }
export interface Appt {
  id: string; code: string; start: string; status: string;
  deptAr: string; deptEn?: string; typeAr: string; typeEn?: string;
  doctorAr: string; doctorEn?: string; barcode: string;
  prepAr?: string | null; prepEn?: string | null; priceFils: number; paymentStatus: string; channel?: string;
}
export interface DocItem { id: string; kind: string; titleAr: string; titleEn: string; issuedAt: string; verifyCode: string }
export interface OverviewPayload {
  patient: { id: string; mrn: string; nameAr: string; nameEn: string; assurance: number; idMasked: string; flags: PatientFlag[]; dob: string; gender: string; phone: string };
  insurance: { payerAr: string; membershipNo: string; validUntil: string | null } | null;
  upcoming: Appt[];
  unreadNotifications: number;
  dueInvoices: { id: string; code: string; totalFils: number; patientFils: number; status: string }[];
  documents: DocItem[];
}
export interface LabResultRow { id: string; testAr: string; testEn: string; value: number; unit: string; flag: string; refLow: number | null; refHigh: number | null; resultedAt: string; comment: string | null }
export interface ImagingRow { id: string; reportAr: string | null; reportEn: string | null; grade: string | null; signedAt: string | null }
export interface RxItem { drugAr: string; drugEn: string; doseAr: string; doseEn: string; frequency: string; instrAr: string | null; instrEn: string | null }
export interface Prescription { id: string; code: string; status: string; createdAt: string; items: RxItem[]; dispensedCount: number }
export interface InvoiceLine { nameAr: string; nameEn: string; qty: number; unitFils: number; vatFils: number }
export interface Invoice { id: string; code: string; status: string; issuedAt: string; subtotalFils: number; vatFils: number; totalFils: number; patientFils: number; insurerFils: number; neutralDesc: string | null; lines: InvoiceLine[] }
export interface PaymentRec { code: string; method: string; amountFils: number; status: string; at: string }
export interface SignedConsent { code: string; templateKey: string; status: string; method: string; signedAt: string; withdrawnAt: string | null }
export interface ConsentTemplate { key: string; titleAr: string; titleEn: string; bodyAr: string; bodyEn: string; minReadSec: number }
export interface NotificationItem { id: string; kind: string; titleAr: string; titleEn: string; bodyAr: string | null; at: string }
export interface Dependant { id: string; mrn: string; nameAr: string; relation: string; dob: string }
export interface GrowthRecord { metric: string; value: number; ageMonths: number; z: number | null; percentile: number | null; flag: string | null }
export interface GrowthChild { child: { id: string; nameAr: string; dob: string }; records: GrowthRecord[] }
export interface AccessLogRow { id: string; at: string; action: string; by: string; role: string; reason: string | null; ip: string | null }
export interface HomeTest { code: string; nameAr: string; nameEn?: string; priceFils: number; fasting: boolean }
export interface HomeTrack { code: string; status: string; slot: string; feeFils: number; tests: HomeTest[]; visit: { eta: string | null; arrivedAt: string | null; drawnAt: string | null } | null; createdAt: string }
export interface ImmunizationItem { id: string; ownerAr: string; ownerEn: string; vaccine: string; vaccineEn: string | null; doseLabel: string; givenAt: string; nextDueAt: string | null }
export interface CatalogService { code: string; nameAr: string; nameEn: string; priceFils: number; durationMin: number; deptAr: string; deptCode: string; prepAr: string | null; prepEn: string | null; isVideo: boolean; fasting: boolean }
export interface CatalogDept { code: string; nameAr: string; nameEn: string; descAr: string | null; descEn: string | null }
export interface CatalogPayload { departments: CatalogDept[]; services: CatalogService[] }
export interface SlotRow { doctorId: string; doctorAr: string; doctorEn: string; at: string; priceFils: number }

// ── error surfacing (RFC7807 bilingual problems) ────────────────────────────
export function errText(e: unknown, lang: Lang): string {
  const p = (e as { problem?: Record<string, unknown> } | null)?.problem;
  if (p) {
    const d = lang === "ar" ? p.detailAr : p.detailEn;
    if (typeof d === "string" && d) return d;
    if (typeof p.title === "string") return p.title;
  }
  return String((e as Error)?.message ?? e);
}

/** +9733XXXXXXX → +973 •••• 2233 (login screen only). */
export function maskPhone(phone: string): string {
  const m = /^\+?973(\d)(\d{3})(\d{4})$/.exec(phone ?? "");
  if (!m) return phone ?? "";
  return `+973 ${m[2] ? "••••" : ""} ${m[3]}`;
}

// ── tiny data-fetch hook (plain useEffect pattern; retryable) ───────────────
export interface FetchState<T> { data: T | null; loading: boolean; error: string | null }
export function useFetch<T>(fn: () => Promise<T>, deps: unknown[] = []): FetchState<T> & { reload: () => void } {
  const { lang } = useI18n();
  const fnRef = useRef(fn);
  useEffect(() => { fnRef.current = fn; });
  const [tick, setTick] = useState(0);
  const [state, setState] = useState<FetchState<T>>({ data: null, loading: true, error: null });
  useEffect(() => {
    let alive = true;
    setState((s) => ({ data: s.data, loading: true, error: null }));
    fnRef.current()
      .then((d) => { if (alive) setState({ data: d, loading: false, error: null }); })
      .catch((e) => { if (alive) setState({ data: null, loading: false, error: errText(e, lang) }); });
    return () => { alive = false; };
  }, [tick, lang, ...deps]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, reload };
}

// ── home draw demo catalog (prices in fils) ─────────────────────────────────
export const HOME_TESTS: HomeTest[] = [
  { code: "CBC", nameAr: "تعداد دم كامل", nameEn: "CBC", priceFils: 9000, fasting: false },
  { code: "GLU-F", nameAr: "سكر صائم", nameEn: "Fasting glucose", priceFils: 5000, fasting: true },
  { code: "VIT-D", nameAr: "فيتامين د", nameEn: "Vitamin D", priceFils: 20000, fasting: false },
  { code: "HBA1C", nameAr: "سكر تراكمي", nameEn: "HbA1c", priceFils: 12000, fasting: false },
];
export const HOME_ZONES: { code: string; feeFils: number; eveningFils: number }[] = [
  { code: "capital", feeFils: 3000, eveningFils: 1500 },
  { code: "muharraq", feeFils: 3500, eveningFils: 1500 },
  { code: "northern", feeFils: 4500, eveningFils: 2000 },
  { code: "southern", feeFils: 5000, eveningFils: 2000 },
];
export const HOME_FLOW: string[] = ["requested", "confirmed", "assigned", "on-the-way", "arrived", "drawn", "to-lab", "delivered"];
