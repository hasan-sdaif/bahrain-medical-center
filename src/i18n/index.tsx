/**
 * i18n — ar/en dictionaries (ICU-lite {var} interpolation). Every user-facing
 * string flows through t(); hard rule: no inline UI literals (§4.8-d).
 */
import { createContext, useContext, useMemo, type ReactNode } from "react";
import core from "./core";
import publicSite from "./public";
import patient from "./patient";
import staffA from "./staff-a";
import staffB from "./staff-b";
import staffC from "./staff-c";
import staffD from "./staff-d";
import admin from "./admin";
import devices from "./devices";

export type Dict = Record<string, { ar: string; en: string }>;

export const dictionaries: Record<string, Dict> = {
  core, public: publicSite, patient, staffA, staffB, staffC, staffD, admin, devices,
};

const flat: Dict = (() => {
  const out: Dict = {};
  for (const [, d] of Object.entries(dictionaries)) {
    for (const [k, v] of Object.entries(d)) out[k] = v;
  }
  return out;
})();

export type Lang = "ar" | "en";

export function translate(key: string, lang: Lang, vars?: Record<string, string | number>): string {
  const entry = flat[key];
  let s = entry ? (lang === "ar" ? entry.ar : entry.en) : key.split(".").pop()!.replace(/([a-z])([A-Z])/g, "$1 $2");
  if (vars) {
    for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  }
  return s;
}

export function dirFor(lang: Lang): "rtl" | "ltr" {
  return lang === "ar" ? "rtl" : "ltr";
}

interface I18nCtx { lang: Lang; setLang: (l: Lang) => void; t: (k: string, vars?: Record<string, string | number>) => string; dir: "rtl" | "ltr" }
const Ctx = createContext<I18nCtx | null>(null);

export function I18nProvider({ lang, setLang, children }: { lang: Lang; setLang: (l: Lang) => void; children: ReactNode }) {
  const value = useMemo<I18nCtx>(
    () => ({ lang, setLang, dir: dirFor(lang), t: (k, v) => translate(k, lang, v) }),
    [lang, setLang],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18nCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useI18n outside provider");
  return c;
}

/** bilingual label helper for data records */
export function bi(lang: Lang, ar?: string | null, en?: string | null): string {
  return (lang === "ar" ? ar || en : en || ar) ?? "";
}
