/**
 * Bahrain context — CPR (9 digits), GCC IDs (configurable per country),
 * +973 phones, governorates/blocks addresses, BHD, UTC+3, VAT, blind index.
 */
import { createHash, createHmac } from "crypto";
import { GCC_ID_RULES, VAT_RULES, VAT_BP, type BahrainAddress, type IdType } from "./types";

export const BH_TZ_OFFSET_MIN = 180; // UTC+03:00, no DST
export const BLIND_INDEX_SECRET = process.env.BLIND_INDEX_SECRET ?? "bmc-dev-blind-index-v1";

export class ValidationError extends Error {
  code: string;
  constructor(code: string, messageAr: string, messageEn: string) {
    super(messageEn);
    this.code = code;
    (this as unknown as { messageAr: string }).messageAr = messageAr;
    (this as unknown as { messageEn: string }).messageEn = messageEn;
  }
}

/** CPR: exactly 9 ASCII digits, no leading zero (rule adjustable via settings). */
export function validateCpr(input: string, { allowLeadingZero = false } = {}): { ok: true; cpr: string } | { ok: false; code: string } {
  const cpr = (input ?? "").replace(/\s|-/g, "");
  if (!/^[0-9]{9}$/.test(cpr)) return { ok: false, code: "ID_INVALID_CPR" };
  if (!allowLeadingZero && cpr.startsWith("0")) return { ok: false, code: "ID_CPR_LEADING_ZERO" };
  return { ok: true, cpr };
}

/** GCC ID: per-country pattern from settings (never hardcode length in code paths). */
export function validateGccId(country: string, input: string): { ok: true; number: string } | { ok: false; code: string } {
  const rule = GCC_ID_RULES[country?.toUpperCase?.() ?? ""];
  if (!rule) return { ok: false, code: "ID_GCC_COUNTRY_UNKNOWN" };
  const num = (input ?? "").replace(/\s/g, "");
  if (!new RegExp(`^${rule.pattern}$`).test(num)) return { ok: false, code: "ID_INVALID_GCC" };
  return { ok: true, number: num };
}

/** Passport: country + alphanumeric, uppercase, no spaces. */
export function normalizePassport(input: string): string {
  return (input ?? "").replace(/\s/g, "").toUpperCase();
}

/** Phone: +973 + 8 digits → E.164. Accepts 3XXXXXXXX, 973XXXXXXXX, +973XXXXXXXX. */
export function normalizeBhPhone(input: string): { ok: true; e164: string; local: string } | { ok: false; code: string } {
  const digits = (input ?? "").replace(/[^\d]/g, "");
  let local = digits;
  if (local.startsWith("973")) local = local.slice(3);
  if (!/^[36789]\d{7}$/.test(local)) return { ok: false, code: "PHONE_INVALID_BH" };
  return { ok: true, e164: `+973${local}`, local };
}

export function maskCpr(cpr: string): string {
  return cpr ? `*****${cpr.slice(-4)}` : "";
}

export function blindIndex(type: IdType, number: string, country = ""): string {
  return createHmac("sha256", BLIND_INDEX_SECRET)
    .update(`${type}|${(number ?? "").toUpperCase().trim()}|${country.toUpperCase()}`)
    .digest("hex")
    .slice(0, 32);
}

export function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

export function vatFor(kind: string, isDrug = false): number {
  if (isDrug) return VAT_RULES.drug ?? VAT_BP.zero;
  return VAT_RULES[kind] ?? VAT_BP.standard;
}

export function normalizeAddress(a: BahrainAddress): BahrainAddress {
  return {
    governorate: a.governorate?.trim(),
    area: a.area?.trim(),
    block: a.block ? String(a.block).trim() : undefined,
    road: a.road ? String(a.road).trim() : undefined,
    building: a.building?.trim(),
    flat: a.flat?.trim(),
    notes: a.notes?.trim(),
    lat: a.lat,
    lng: a.lng,
  };
}

export function addressLabel(a: BahrainAddress | null | undefined, lang: "ar" | "en" = "ar"): string {
  if (!a) return "";
  const parts =
    lang === "ar"
      ? [a.area, a.block && `بلوك ${a.block}`, a.road && `شارع ${a.road}`, a.building, a.flat]
      : [a.area, a.block && `Block ${a.block}`, a.road && `Rd ${a.road}`, a.building, a.flat];
  return parts.filter(Boolean).join("، ");
}

/** UTC+3 display helpers (storage stays UTC). */
export function bhTime(date: Date | string): Date {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Date(d.getTime() + BH_TZ_OFFSET_MIN * 60000);
}
export function bhIso(date: Date | string): string {
  return bhTime(date).toISOString().replace("Z", "+03:00");
}
export function bhTimeString(date: Date | string): string {
  return bhTime(date).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}
export function bhDateString(date: Date | string): string {
  return bhTime(date).toLocaleDateString("en-GB");
}

/** Age in months (for pediatrics) / years. */
export function ageOf(dob: Date | string, at: Date = new Date()): { years: number; months: number } {
  const d = new Date(dob);
  let months = (at.getFullYear() - d.getFullYear()) * 12 + (at.getMonth() - d.getMonth());
  if (at.getDate() < d.getDate()) months--;
  return { years: Math.floor(months / 12), months: Math.max(0, months) };
}
