/**
 * Numbering dictionary (§4.8-هـ) — atomic sequences + Luhn check digit for MRN.
 * Formats: P26-0000123-7, V-261020-0187, O-…, S-…, RX-…, INV-2026-004512,
 * CLM-…, CST-…, A-042, AST-LAB-014, ITM-DNT-0089, LOT-…, FR-…, WO-…,
 * PO-…, HV-…, EMP-…, PAY-…, RF-…, PA-…
 */
import { db } from "./db";
import { sha256 } from "./bahrain";

export function luhnCheckDigit(input: string): number {
  let sum = 0;
  let dbl = true; // rightmost will be doubled as we iterate from the end
  for (let i = input.length - 1; i >= 0; i--) {
    let d = input.charCodeAt(i) - 48;
    if (dbl) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    dbl = !dbl;
  }
  return (10 - (sum % 10)) % 10;
}

export function luhnValid(full: string): boolean {
  const parts = full.split("-");
  const provided = Number(parts[parts.length - 1]);
  if (Number.isNaN(provided)) return false;
  const base = parts.slice(0, -1).join("").replace(/[^0-9]/g, "");
  return luhnCheckDigit(base) === provided;
}

/** Atomic next for a sequence key. */
export async function nextSeq(key: string, count = 1): Promise<number> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const row = await db.numberSequence.upsert({
      where: { key },
      create: { key, next: 2 },
      update: { next: { increment: count } },
    });
    if (row.next - count >= 1) return row.next - count; // value before increment
  }
  throw new Error("SEQ_RACE");
}

function daily(): string {
  const d = new Date(Date.now() + 180 * 60000); // BH date
  const y = String(d.getUTCFullYear()).slice(2);
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

function yy(): string {
  return String(new Date(Date.now() + 180 * 60000).getUTCFullYear()).slice(2);
}
function yyyy(): string {
  return String(new Date(Date.now() + 180 * 60000).getUTCFullYear());
}

const pad = (n: number, w: number) => String(n).padStart(w, "0");

export async function nextMrn(): Promise<string> {
  const n = await nextSeq("mrn");
  const base = `P${yy()}-${pad(n, 7)}`;
  return `${base}-${luhnCheckDigit(base.replace(/[^0-9]/g, ""))}`;
}

export const nextEncounterCode = async () => `V-${daily()}-${pad(await nextSeq("encounter"), 4)}`;
export const nextOrderCode = async () => `O-${daily()}-${pad(await nextSeq("order"), 4)}`;
export const nextSpecimenCode = async () => `S-${daily()}-${pad(await nextSeq("specimen"), 4)}`;
export const nextRxCode = async () => `RX-${daily()}-${pad(await nextSeq("rx"), 4)}`;
export const nextInvoiceCode = async () => `INV-${yyyy()}-${pad(await nextSeq("invoice"), 6)}`;
export const nextClaimCode = async () => `CLM-${daily()}-${pad(await nextSeq("claim"), 4)}`;
export const nextConsentCode = async () => `CST-${daily()}-${pad(await nextSeq("consent"), 4)}`;
export const nextFrCode = async () => `FR-${daily()}-${pad(await nextSeq("fault"), 3)}`;
export const nextWoCode = async () => `WO-${daily()}-${pad(await nextSeq("wo"), 3)}`;
export const nextLotCode = async () => `LOT-${daily()}-${pad(await nextSeq("lot"), 3)}`;
export const nextHvCode = async () => `HV-${daily()}-${pad(await nextSeq("hv"), 4)}`;
export const nextPayCode = async () => `PAY-${yyyy()}-${pad(await nextSeq("payment"), 6)}`;
export const nextReferralCode = async () => `RF-${daily()}-${pad(await nextSeq("referral"), 4)}`;
export const nextPreAuthCode = async () => `PA-${daily()}-${pad(await nextSeq("preauth"), 3)}`;
export async function nextTicket(letter: string): Promise<string> {
  const n = await nextSeq(`ticket:${letter}`);
  return `${letter}-${pad(n % 1000, 3)}`;
}
export function assetCode(category: string, seq: number): string {
  return `AST-${category.toUpperCase().slice(0, 4)}-${pad(seq, 3)}`;
}
export function itemCode(category: string, seq: number): string {
  return `ITM-${category.toUpperCase().slice(0, 3)}-${pad(seq, 4)}`;
}
export const nextEmpNo = async () => `EMP-${pad(await nextSeq("emp"), 4)}`;
export function docVerificationCode(): string {
  const rnd = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  return `BMC-${sha256(rnd).slice(0, 22).toUpperCase()}`;
}
export const nextIncidentCode = async () => `INC-${daily()}-${pad(await nextSeq("incident"), 3)}`;
export const nextComplaintCode = async () => `CMP-${daily()}-${pad(await nextSeq("complaint"), 3)}`;
export const nextApptCode = async () => `A-${daily()}-${pad(await nextSeq("appt"), 4)}`;
export const webBookingCode = () => `WB-${daily()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
