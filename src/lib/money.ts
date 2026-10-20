/**
 * Money — BHD with 3 decimals (fils). All amounts are integers in fils.
 * Never floats (§17.10). 1.500 BHD = 1500 fils.
 */
export type Fils = number; // integer

export const BHD3 = (fils: Fils): string => {
  const neg = fils < 0;
  const abs = Math.abs(Math.trunc(fils));
  const whole = Math.floor(abs / 1000);
  const frac = String(abs % 1000).padStart(3, "0");
  return `${neg ? "-" : ""}${whole}.${frac}`;
};

export const FILS = (bhd: string | number): Fils => {
  const s = String(bhd).trim();
  const m = /^-?\d+(\.\d+)?$/.exec(s);
  if (!m) return 0;
  const [w, f = ""] = s.split(".");
  const frac = (f + "000").slice(0, 3);
  const sign = s.startsWith("-") ? -1 : 1;
  // overflow-safe: avoid float for typical amounts
  const int = parseInt(w.replace("-", ""), 10) * 1000 + parseInt(frac, 10);
  return sign * int;
};

export const addFils = (...xs: Fils[]): Fils => xs.reduce((a, b) => a + b, 0);
export const mulFils = (f: Fils, q: number): Fils => f * q;
/** Percent in basis points (5% => 500) of a fils amount, half-up rounded to fils. */
export const bpOfFils = (f: Fils, bp: number): Fils => Math.round((f * bp) / 10000);
export const pctOfFils = (f: Fils, percent: number): Fils => bpOfFils(f, percent * 100);

export const fmtBHD = (fils: Fils, lang: "ar" | "en" = "ar"): string =>
  lang === "ar" ? `${BHD3(fils)} د.ب` : `BHD ${BHD3(fils)}`;

/** Split payer responsibility: copay (flat fils) + coinsurance (% after copay). */
export function splitPayer(
  netFils: Fils,
  copayFils: Fils,
  coinsPct: number,
  ceilingFils: Fils = 0,
): { patientDue: Fils; insurerDue: Fils; capped: boolean } {
  let patient = Math.min(netFils, copayFils);
  let rest = netFils - patient;
  const coinsFils = pctOfFils(rest, coinsPct);
  patient += coinsFils;
  rest -= coinsFils;
  let insurer = rest;
  let capped = false;
  if (ceilingFils > 0 && insurer > ceilingFils) {
    insurer = ceilingFils;
    capped = true;
    patient = netFils - insurer; // ما فوق السقف على المريض (سياسة قابلة للضبط)
  }
  return { patientDue: Math.max(0, patient), insurerDue: Math.max(0, insurer), capped };
}

export function computeInvoiceMath(
  lines: { unitFils: Fils; qty: number; vatBp: number }[],
  discountFils: Fils = 0,
): { subtotal: Fils; vat: Fils; total: Fils } {
  let subtotal = 0;
  let vat = 0;
  for (const l of lines) {
    const gross = mulFils(l.unitFils, l.qty);
    subtotal += gross;
    vat += bpOfFils(gross, l.vatBp);
  }
  const total = subtotal + vat - discountFils;
  return { subtotal, vat, total: Math.max(0, total) };
}
