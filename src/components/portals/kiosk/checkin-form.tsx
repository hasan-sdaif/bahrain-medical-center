"use client";
/**
 * Kiosk input — Shamel guide flow (kiosk-welcome → kiosk-scan | kiosk-cpr).
 * Welcome glass card with two big action tiles; scan state keeps the
 * auto-focused scanner input (guns "type" into it) framed by .scan-frame +
 * .scan-line; CPR state drives the same digits state through .kiosk-num-key.
 */
import { useEffect, useRef, useState } from "react";
import { Accessibility, Check, ChevronLeft, ChevronRight, Delete, IdCard, ScanBarcode, Siren } from "lucide-react";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import type { KioskErrorKind } from "./index";

export type CheckinPayload = { barcode: string } | { cpr: string } | { mrn: string };

/** normalise user input into BMC-APPT-… form */
function normaliseBarcode(v: string): string {
  const raw = v.trim().toUpperCase().replace(/\s+/g, "");
  if (!raw) return "";
  const suffix = raw.startsWith("BMC-APPT-") ? raw.slice(9) : raw.startsWith("BMC-APPT") ? raw.slice(8) : raw;
  return `BMC-APPT-${suffix.replace(/[^A-Z0-9-]/g, "")}`;
}

/** 3-3-3 grouping for the CPR display */
function groupCpr(d: string): string {
  return [d.slice(0, 3), d.slice(3, 6), d.slice(6, 9)].filter(Boolean).join(" ");
}

type Mode = "welcome" | "scan" | "cpr";

export default function CheckinForm({
  busy, error, onSubmit,
}: { busy: boolean; error: KioskErrorKind | null; onSubmit: (p: CheckinPayload) => void }) {
  const { t, dir } = useI18n();
  const [mode, setMode] = useState<Mode>("welcome");
  const [barcode, setBarcode] = useState("");
  const [digits, setDigits] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const Back = dir === "rtl" ? ChevronRight : ChevronLeft;

  // keep the scanner input focused (kiosk guns "type" into it)
  useEffect(() => {
    if (mode === "scan" && !busy) inputRef.current?.focus();
  }, [mode, busy, error]);

  const submitBarcode = () => {
    const v = normaliseBarcode(barcode);
    if (v.length > "BMC-APPT-".length) onSubmit({ barcode: v });
  };
  const submitCpr = () => {
    if (digits.length === 9) onSubmit({ cpr: digits });
  };
  const key = (d: string) => setDigits((prev) => (prev.length >= 9 ? prev : prev + d));

  if (mode === "welcome") {
    return (
      <section className="kiosk-card" aria-label={t("kiosk.welcome")}>
        <span className="mx-auto mb-4 grid size-24 place-items-center rounded-full bg-white/10" aria-hidden>
          <ScanBarcode className="size-12" strokeWidth={1.6} />
        </span>
        <h1 className="text-white text-3xl md:text-4xl font-extrabold font-[family-name:var(--font-cairo)]">
          {t("kiosk.welcomeTitle")}
        </h1>
        <p className="mx-auto mt-2 max-w-md text-white/75 text-lg">{t("kiosk.welcomeSub")}</p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <button
            type="button"
            className="kiosk-num-key h-32 md:h-36 flex-col justify-center gap-2 bg-white/[.07] px-4"
            onClick={() => setMode("scan")}
          >
            <ScanBarcode className="size-10" strokeWidth={1.5} aria-hidden />
            <b className="font-sans text-lg">{t("kiosk.scanTitle")}</b>
            <span className="font-sans text-sm text-white/70">{t("kiosk.scanTileSub")}</span>
          </button>
          <button
            type="button"
            className="kiosk-num-key h-32 md:h-36 flex-col justify-center gap-2 bg-white/[.07] px-4"
            onClick={() => setMode("cpr")}
          >
            <IdCard className="size-10" strokeWidth={1.5} aria-hidden />
            <b className="font-sans text-lg">{t("kiosk.cprTitle")}</b>
            <span className="font-sans text-sm text-white/70">{t("kiosk.cprHint")}</span>
          </button>
        </div>

        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <span className="badge rounded-full bg-teal-400/15 px-4 py-2 text-sm text-teal-200">
            <Accessibility className="size-4" aria-hidden /> {t("kiosk.a11yWheel")}
          </span>
          <span className="badge rounded-full bg-white/10 px-4 py-2 text-sm text-white/80">
            <Siren className="size-4" aria-hidden /> {t("kiosk.a11yEr")}
          </span>
        </div>
      </section>
    );
  }

  if (mode === "scan") {
    return (
      <section className="kiosk-card max-w-xl" aria-label={t("kiosk.scanTitle")}>
        <h1 className="text-white text-2xl md:text-3xl font-extrabold font-[family-name:var(--font-cairo)]">
          {t("kiosk.scanTitle")}
        </h1>
        <p className="mt-1 text-white/70">{t("kiosk.scanHint")}</p>

        <div className="scan-frame mt-7 block rounded-2xl p-5">
          <span className="sf-b" aria-hidden />
          <label htmlFor="kiosk-barcode" className="sr-only">{t("kiosk.scanTitle")}</label>
          <input
            ref={inputRef}
            id="kiosk-barcode"
             
            autoFocus
            dir="ltr"
            inputMode="text"
            autoComplete="off"
            spellCheck={false}
            placeholder={t("kiosk.barcodePlaceholder")}
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submitBarcode(); }}
            className="mono h-28 w-full rounded-xl bg-black/35 py-6 text-center text-2xl font-semibold uppercase tracking-[.18em] text-white placeholder:text-white/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300/70"
          />
          <span className="scan-line" aria-hidden />
        </div>

        <button
          type="button"
          disabled={busy || normaliseBarcode(barcode).length <= "BMC-APPT-".length}
          onClick={submitBarcode}
          className="btn btn-lg btn-primary mt-6 w-full"
        >
          {busy ? t("kiosk.processing") : t("kiosk.submit")}
        </button>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-4 text-sm">
          <button type="button" className="inline-flex items-center gap-1.5 text-white/75 hover:text-white" onClick={() => setMode("cpr")}>
            {t("kiosk.useCpr")}
          </button>
          <button type="button" className="inline-flex items-center gap-1.5 text-white/75 hover:text-white" onClick={() => setMode("welcome")}>
            <Back className="size-4" aria-hidden /> {t("kiosk.back")}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="kiosk-card max-w-xl" aria-label={t("kiosk.cprTitle")}>
      <h1 className="text-white text-2xl md:text-3xl font-extrabold font-[family-name:var(--font-cairo)]">
        {t("kiosk.cprTitle")}
      </h1>
      <p className="mt-1 text-white/70">{t("kiosk.cprHint")}</p>

      {/* 3-3-3 display */}
      <p dir="ltr" aria-label={t("kiosk.cprTitle")} className="kiosk-cpr-display mt-6">
        {groupCpr(digits) || <span className="text-white/35">••• ••• •••</span>}
        <span className="sr-only">{digits.length}/9</span>
      </p>

      {/* keypad — guide .kiosk-num-key, ≥64px touch targets */}
      <div className="mt-6 grid grid-cols-3 gap-3" role="group" aria-label={t("kiosk.cprTitle")}>
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <button key={d} type="button" disabled={busy} onClick={() => key(d)} className="kiosk-num-key h-16 md:h-[72px]">
            {d}
          </button>
        ))}
        <button
          type="button" aria-label={t("kiosk.delete")} disabled={busy || !digits}
          onClick={() => setDigits((p) => p.slice(0, -1))}
          className="kiosk-num-key h-16 bg-red-500/25 md:h-[72px]"
        >
          <Delete className="mx-auto size-7" aria-hidden />
        </button>
        <button type="button" disabled={busy} onClick={() => key("0")} className="kiosk-num-key h-16 md:h-[72px]">0</button>
        <button
          type="button" disabled={busy || digits.length !== 9} onClick={submitCpr}
          className={cn(
            "kiosk-num-key h-16 gap-2 md:h-[72px]",
            digits.length === 9 && !busy ? "bg-teal-500 text-[#042F2E]" : "opacity-40",
          )}
        >
          <Check className="mx-auto size-7" aria-hidden />
          <span className="sr-only">{t("kiosk.submit")}</span>
        </button>
      </div>

      <div className="mt-5 flex items-center justify-between">
        <button type="button" className="inline-flex items-center gap-1.5 text-white/75 hover:text-white" onClick={() => setMode("welcome")}>
          <Back className="size-4" aria-hidden /> {t("kiosk.back")}
        </button>
        <button
          type="button" disabled={busy || !digits} onClick={() => setDigits("")}
          className="text-white/75 hover:text-white"
        >
          {t("kiosk.clear")}
        </button>
        <span className="num text-sm text-white/60" aria-hidden>{digits.length}/9</span>
      </div>
    </section>
  );
}
