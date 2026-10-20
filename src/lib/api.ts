/**
 * API helpers — RFC 7807 bilingual errors, demo session context, guards.
 * (The sandbox runs a simulated auth: each request declares its actor via
 *  headers/body; production swaps this for OIDC tokens with aud checks.)
 */
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

export interface ApiErrorSpec { code: string; ar: string; en: string; status?: number }

const ERRORS: Record<string, { ar: string; en: string; status: number }> = {
  ID_INVALID_CPR: { ar: "الرقم الشخصي غير صحيح (9 أرقام)", en: "Invalid CPR (9 digits)", status: 422 },
  ID_DUPLICATE: { ar: "هوية مسجلة مسبقاً لمريض موجود", en: "Identifier already exists", status: 409 },
  SLOT_TAKEN: { ar: "الفتحة محجوزة — تعارض جدولة", en: "Slot taken — scheduling conflict", status: 409 },
  PATIENT_DOUBLE_BOOKED: { ar: "لدى المريض موعد متزامن", en: "Patient double-booked", status: 409 },
  NOT_FOUND: { ar: "غير موجود", en: "Not found", status: 404 },
  FORBIDDEN: { ar: "غير مصرح", en: "Forbidden", status: 403 },
  UNAUTHORIZED: { ar: "يلبث تسجيل الدخول", en: "Authentication required", status: 401 },
  CONSENT_REQUIRED: { ar: "موافقة سارية مطلوبة قبل التنفيذ", en: "Valid consent required (hard stop)", status: 412 },
  READER_OFFLINE: { ar: "قارئ البطاقة غير متصل", en: "Card reader offline", status: 503 },
  CRITICAL_RESULT: { ar: "قيمة حرجة — لا إفراج قبل التواصل السريري", en: "Critical value — clinical contact first", status: 412 },
  STATE_INVALID: { ar: "الحالة لا تسمح بهذه العملية", en: "Illegal state transition", status: 409 },
  VALIDATION: { ar: "بيانات غير صحيحة", en: "Invalid input", status: 422 },
  ID_INVALID_GCC: { ar: "رقم الهوية الخليجية غير صحيح", en: "Invalid GCC ID", status: 422 },
  PHONE_INVALID_BH: { ar: "هاتف بحريني غير صحيح (+973 ثم 8 أرقام تبدأ 3/6/7/8/9)", en: "Invalid BH phone", status: 422 },
  PAYMENT_FAILED: { ar: "فشل الدفع", en: "Payment failed", status: 402 },
  IDEMPOTENT_DUP: { ar: "طلب مكرر (نفس المفتاح)", en: "Duplicate idempotency key", status: 409 },
};

export function problem(code: string, extra?: Record<string, unknown>, statusOverride?: number) {
  const e = ERRORS[code] ?? { ar: code, en: code, status: 400 };
  return NextResponse.json(
    {
      type: "about:blank", title: code, code,
      detailAr: e.ar, detailEn: e.en,
      status: statusOverride ?? e.status,
      ...extra,
    },
    { status: statusOverride ?? e.status, headers: { "Content-Type": "application/problem+json" } },
  );
}

export const ok = (data: unknown, init?: ResponseInit) => NextResponse.json(data as object, init);

export function j<T>(v: unknown, fallback: T): T {
  return (v === null || v === undefined) ? fallback : (v as T);
}
export const ja = (v: unknown): unknown[] => j(v, [] as unknown[]);
export const jo = (v: unknown): Record<string, unknown> => j(v, {} as Record<string, unknown>);

// ── Demo session context ────────────────────────────────────────────────────
export interface Actor {
  id: string; role: string; nameAr: string; nameEn: string;
  departmentId?: string | null; patientId?: string | null; // patient world
  audience: "staff" | "patient" | "public" | "device" | "partner";
}
export function actorFrom(req: Request): Actor | null {
  const h = req.headers;
  const raw = h.get("x-bmc-actor");
  if (raw) {
    try { const a = JSON.parse(Buffer.from(raw, "base64").toString("utf8")); return a; } catch { /* fallthrough */ }
  }
  return null;
}
export function requireActor(req: Request, audience: Actor["audience"][]): Actor | null {
  const a = actorFrom(req);
  if (!a) return null;
  if (!audience.includes(a.audience)) return null;
  return a;
}

export async function readJson<T>(req: Request): Promise<T> {
  try { return (await req.json()) as T; } catch { return {} as T; }
}

export function pageParams(url: URL, defLimit = 50): { skip: number; take: number } {
  const skip = Math.max(0, Number(url.searchParams.get("skip") ?? 0));
  const take = Math.min(500, Math.max(1, Number(url.searchParams.get("take") ?? defLimit)));
  return { skip, take };
}

export const jsonv = (x: unknown): Prisma.InputJsonValue => x as Prisma.InputJsonValue;
