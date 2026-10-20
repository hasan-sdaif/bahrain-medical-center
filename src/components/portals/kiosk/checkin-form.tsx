"use client";
/**
 * Kiosk input — primary "scan appointment barcode" card (auto-focused input,
 * accepts pasted/scanned BMC-APPT-…) + secondary "enter CPR" card with a
 * 9-digit on-screen keypad (56px+ keys, 3-3-3 display). Touch-first.
 */
import { useEffect, useRef, useState } from "react";
import { Check, Delete, IdCard, ScanLine } from "lucide-react";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
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

export default function CheckinForm({
  busy, error, onSubmit,
}: { busy: boolean; error: KioskErrorKind | null; onSubmit: (p: CheckinPayload) => void }) {
  const { t } = useI18n();
  const [mode, setMode] = useState<"barcode" | "cpr">("barcode");
  const [barcode, setBarcode] = useState("");
  const [digits, setDigits] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // keep the scanner input focused (kiosk guns "type" into it)
  useEffect(() => {
    if (mode === "barcode" && !busy) inputRef.current?.focus();
  }, [mode, busy, error]);

  const submitBarcode = () => {
    const v = normaliseBarcode(barcode);
    if (v.length > "BMC-APPT-".length) onSubmit({ barcode: v });
  };
  const submitCpr = () => {
    if (digits.length === 9) onSubmit({ cpr: digits });
  };

  const key = (d: string) => setDigits((prev) => (prev.length >= 9 ? prev : prev + d));

  return (
    <div className="w-full max-w-3xl mx-auto px-6 md:px-10 pt-6 grid gap-6">
      {/* mode switch */}
      <div className="grid grid-cols-2 gap-3" role="tablist" aria-label={t("kiosk.title")}>
        <Button
          role="tab" aria-selected={mode === "barcode"} variant={mode === "barcode" ? "default" : "outline"}
          className="h-14 text-lg font-bold rounded-2xl gap-2"
          onClick={() => setMode("barcode")}
        >
          <ScanLine className="size-5" aria-hidden /> {t("kiosk.scanTitle")}
        </Button>
        <Button
          role="tab" aria-selected={mode === "cpr"} variant={mode === "cpr" ? "default" : "outline"}
          className="h-14 text-lg font-bold rounded-2xl gap-2"
          onClick={() => setMode("cpr")}
        >
          <IdCard className="size-5" aria-hidden /> {t("kiosk.cprTitle")}
        </Button>
      </div>

      {mode === "barcode" ? (
        <section
          aria-label={t("kiosk.scanTitle")}
          className="rounded-3xl border-2 border-primary/40 bg-card p-6 md:p-8 shadow-xl"
        >
          <div className="flex items-center gap-4">
            <span className="grid size-16 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
              <ScanLine className="size-9" aria-hidden />
            </span>
            <div>
              <h2 className="text-2xl md:text-3xl font-bold">{t("kiosk.scanTitle")}</h2>
              <p className="text-base md:text-lg text-muted-foreground mt-1">{t("kiosk.scanHint")}</p>
            </div>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-[1fr_auto]">
            <input
              ref={inputRef}
              autoFocus
              dir="ltr"
              inputMode="text"
              autoComplete="off"
              spellCheck={false}
              aria-label={t("kiosk.scanTitle")}
              placeholder={t("kiosk.barcodePlaceholder")}
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submitBarcode(); }}
              className="h-16 w-full rounded-2xl border-2 border-input bg-background px-5 text-center font-mono text-2xl tracking-wider uppercase focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
            />
            <Button
              size="lg"
              disabled={busy || normaliseBarcode(barcode).length <= "BMC-APPT-".length}
              onClick={submitBarcode}
              className="h-16 px-10 text-xl font-bold rounded-2xl"
            >
              {busy ? t("kiosk.processing") : t("kiosk.submit")}
            </Button>
          </div>
        </section>
      ) : (
        <section
          aria-label={t("kiosk.cprTitle")}
          className="rounded-3xl border-2 border-primary/40 bg-card p-6 md:p-8 shadow-xl"
        >
          <h2 className="text-2xl md:text-3xl font-bold">{t("kiosk.cprTitle")}</h2>
          <p className="text-base md:text-lg text-muted-foreground mt-1">{t("kiosk.cprHint")}</p>

          {/* 3-3-3 display */}
          <p
            dir="ltr"
            aria-label={t("kiosk.cprTitle")}
            className="mt-5 rounded-2xl border-2 border-input bg-background py-4 text-center font-mono text-4xl md:text-5xl font-bold tracking-[0.35em] tabular-nums min-h-16"
          >
            {groupCpr(digits) || <span className="text-muted-foreground/50">••• ••• •••</span>}
          </p>

          {/* keypad — keys ≥56px, touch-first */}
          <div className="mt-5 grid grid-cols-3 gap-3" role="group" aria-label={t("kiosk.cprTitle")}>
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
              <button
                key={d}
                type="button"
                disabled={busy}
                onClick={() => key(d)}
                className="h-16 md:h-20 rounded-2xl border-2 bg-background text-3xl font-bold tabular-nums shadow-sm transition hover:bg-accent active:scale-95 disabled:opacity-40"
              >
                {d}
              </button>
            ))}
            <button
              type="button"
              aria-label={t("kiosk.delete")}
              disabled={busy || !digits}
              onClick={() => setDigits((p) => p.slice(0, -1))}
              className="h-16 md:h-20 rounded-2xl border-2 bg-background grid place-items-center shadow-sm transition hover:bg-accent active:scale-95 disabled:opacity-40"
            >
              <Delete className="size-7" aria-hidden />
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => key("0")}
              className="h-16 md:h-20 rounded-2xl border-2 bg-background text-3xl font-bold tabular-nums shadow-sm transition hover:bg-accent active:scale-95 disabled:opacity-40"
            >
              0
            </button>
            <button
              type="button"
              aria-label={t("kiosk.submit")}
              disabled={busy || digits.length !== 9}
              onClick={submitCpr}
              className={cn(
                "h-16 md:h-20 rounded-2xl border-2 grid place-items-center shadow-sm transition active:scale-95",
                digits.length === 9 && !busy
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-background opacity-40",
              )}
            >
              <Check className="size-8" aria-hidden />
            </button>
          </div>

          <div className="mt-4 flex justify-between items-center">
            <Button variant="ghost" className="h-12 px-4 text-base" disabled={busy || !digits} onClick={() => setDigits("")}>
              {t("kiosk.clear")}
            </Button>
            <span className="text-sm text-muted-foreground tabular-nums" aria-hidden>{digits.length}/9</span>
          </div>
        </section>
      )}
    </div>
  );
}
