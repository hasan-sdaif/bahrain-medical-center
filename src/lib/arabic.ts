/**
 * Arabic search engine (§17.2/§17.3) — normalization, fuzzy matching,
 * duplicate scoring. Shared by patient search + registration guard.
 */
const DIACRITICS = /[\u064B-\u0652\u0670\u0640]/g; // harakat + tatweel

export function normalizeArabic(name: string): string {
  let s = (name ?? "").trim();
  s = s.replace(DIACRITICS, "");
  s = s.replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/ؤ/g, "و").replace(/ئ/g, "ي").replace(/ـ/g, "");
  s = s.replace(/\s+/g, " ");
  const stop = new Set(["ال", "بن", "بنت"]);
  const tokens = s.split(" ").filter((t) => t && !stop.has(t));
  // unify compound عبدالله/عبد الله by joining عبد + الله
  const out: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i] === "عبد" && tokens[i + 1] === "الله") {
      out.push("عبدالله");
      i++;
    } else out.push(tokens[i]);
  }
  return out.join(" ");
}

/** Simple Arabic→Latin transliteration for cross-script mistakes. */
const AR2LAT: Record<string, string> = {
  ا: "a", أ: "a", إ: "i", آ: "a", ب: "b", ت: "t", ث: "th", ج: "j", ح: "h", خ: "kh",
  د: "d", ذ: "dh", ر: "r", ز: "z", س: "s", ش: "sh", ص: "s", ض: "d", ط: "t", ظ: "z",
  ع: "a", غ: "gh", ف: "f", ق: "q", ك: "k", ل: "l", م: "m", ن: "n", ه: "h", و: "w", ي: "y",
};
export function translitAr(s: string): string {
  return normalizeArabic(s).split("").map((c) => AR2LAT[c] ?? c).join("");
}

export function levenshtein(a: string, b: string, max = Infinity): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const prev = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    let cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    if (Math.min(...cur) > max) return max + 1;
    for (let j = 0; j <= b.length; j++) prev[j] = cur[j];
    cur = [] as unknown as number[];
  }
  return prev[b.length];
}

export function nameSimilarity(a: string, b: string): number {
  const na = normalizeArabic(a);
  const nb = normalizeArabic(b);
  if (na === nb) return 1;
  const d = levenshtein(na, nb, 4);
  if (d > 4) {
    const la = translitAr(a).toLowerCase();
    const lb = (b.match(/[a-z]/i) ? b.toLowerCase() : translitAr(b).toLowerCase());
    return levenshtein(la, lb, 4) <= 2 ? 0.8 : 0;
  }
  return Math.max(0, 1 - d / 5);
}

export interface DupCandidate {
  id: string; mrn: string; nameAr: string; nameEn: string | null; dob: Date | string; phone: string | null;
  idMasked: string; lastVisitAt: Date | string | null; score: number;
}

/** Probabilistic duplicate score (§17.3-b). ≥70 → WARN. */
export function duplicateScore(
  probe: { nameAr: string; dob: Date; phone?: string | null; gender: string; motherName?: string | null },
  other: { nameAr: string; dob: Date; phone?: string | null; gender: string; motherName?: string | null },
): number {
  let score = 0;
  const na = normalizeArabic(probe.nameAr);
  const nb = normalizeArabic(other.nameAr);
  if (na === nb) score += 40;
  else if (levenshtein(na, nb, 2) <= 2) score += 25;
  if (new Date(probe.dob).getTime() === new Date(other.dob).getTime()) score += 25;
  if (probe.phone && other.phone && probe.phone === other.phone) score += 15;
  if (probe.motherName && other.motherName && normalizeArabic(probe.motherName) === normalizeArabic(other.motherName)) score += 10;
  if (probe.gender !== other.gender) score -= 30;
  return Math.max(0, score);
}

export function maskedCandidateLabel(p: { nameAr: string; dob: Date; idLast4?: string; lastVisitAt?: Date | null }, lang: "ar" | "en" = "ar"): string {
  const age = Math.max(0, Math.floor((Date.now() - new Date(p.dob).getTime()) / 3.15576e10));
  return lang === "ar"
    ? `${p.nameAr} — ${age} سنة${p.idLast4 ? ` — *****${p.idLast4}` : ""}`
    : `${p.nameAr} — ${age}y${p.idLast4 ? ` — *****${p.idLast4}` : ""}`;
}
