"use client";
/**
 * verify.website.bh — Shamel guide public document verification:
 * centered search card (.mono code input + btn-primary), result states with
 * .alert-success / .alert-danger + details card, print action (print-area).
 * Demo chips use the deterministic seeded codes (server-side constants).
 */
import { useCallback, useRef, useState } from "react";
import { Barcode, QrCode, ShieldCheck } from "lucide-react";
import { useI18n } from "@/i18n";
import { apiPost } from "@/lib/api-client";
import { ShamelAccent, ShamelBrand } from "@/components/shell/brand";
import { Skeleton } from "@/components/ui/skeleton";
import { VerifyResultCard, type VerifyResult } from "./result-card";

const DEMO_CODES: { code: string; labelKey: string }[] = [
  { code: "BMC-C63EBDCBE00C06B7D93143", labelKey: "verify.demoValidReport" },
  { code: "BMC-7897A2D21D9787E908F88C", labelKey: "verify.demoValidCert" },
  { code: "BMC-EXAMPLE123", labelKey: "verify.demoInvalid" },
];

/** uppercase mono formatting: always BMC-prefixed, 22-char body */
function formatCode(v: string): string {
  const raw = v.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!raw || raw === "BMC") return "";
  if (raw.startsWith("BMC")) return `BMC-${raw.slice(3, 25)}`;
  return `BMC-${raw.slice(0, 22)}`;
}

export default function VerifyPortal() {
  const { t } = useI18n();
  const [code, setCode] = useState("");
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = useCallback(async (value: string) => {
    const clean = formatCode(value);
    if (!clean) return;
    setBusy(true);
    setFailed(false);
    try {
      const r = await apiPost<VerifyResult>("/api/verify/check", { code: clean });
      setResult(r);
    } catch {
      setFailed(true);
      setResult(null);
    } finally {
      setBusy(false);
    }
  }, []);

  const reset = useCallback(() => {
    setResult(null);
    setFailed(false);
    setCode("");
    inputRef.current?.focus();
  }, []);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 md:py-12">
      <ShamelAccent />

      {/* identity — small header */}
      <header className="text-center">
        <ShamelBrand
          name={t("shell.app.name")}
          sub={t("verify.title")}
          size={52}
          className="mx-auto w-fit"
        />
        <h1 className="mt-5 text-3xl font-extrabold md:text-4xl">{t("verify.title")}</h1>
        <p className="mx-auto mt-2 max-w-lg text-base text-ink-3 md:text-lg">{t("verify.subtitle")}</p>
      </header>

      {/* code form — centered search card */}
      <form
        className="card mt-8 p-4 shadow-md"
        onSubmit={(e) => { e.preventDefault(); void submit(code); }}
      >
        <div className="card-body grid gap-3 p-0 sm:grid-cols-[1fr_auto]">
          <label htmlFor="verify-code" className="sr-only">{t("verify.codeLabel")}</label>
          <input
            ref={inputRef}
            id="verify-code"
            dir="ltr"
            inputMode="text"
            autoComplete="off"
            spellCheck={false}
             
            autoFocus
            aria-label={t("verify.codeLabel")}
            placeholder={t("verify.codeLabel")}
            value={code}
            onChange={(e) => setCode(formatCode(e.target.value))}
            className="mono h-14 w-full rounded-xl border border-line bg-surface-2 px-5 text-lg font-semibold uppercase tracking-wider text-ink transition focus-visible:outline-none focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/25"
          />
          <button
            type="submit"
            disabled={busy || formatCode(code).length < 10}
            className="btn btn-primary btn-lg h-14 px-8"
          >
            <ShieldCheck className="size-5" aria-hidden />
            {busy ? t("verify.checking") : t("verify.submit")}
          </button>
        </div>
      </form>

      {/* result */}
      <div aria-live="polite" className="mt-6 grid gap-4">
        {busy && <Skeleton className="h-40 rounded-2xl" />}
        {!busy && failed && (
          <div role="alert" className="alert alert-danger">
            <span className="al-ic"><Barcode className="size-5" aria-hidden /></span>
            <div>
              <p className="al-title">{t("verify.errTitle")}</p>
              {t("verify.errGeneric")}
            </div>
          </div>
        )}
        {!busy && result && <VerifyResultCard result={result} onReset={reset} />}
      </div>

      {/* demo chips — clearly labelled */}
      <section aria-label={t("verify.demo")} className="card mt-8 border-dashed p-5">
        <p className="text-sm font-bold text-primary">{t("verify.demo")}</p>
        <div className="mt-3 flex flex-wrap gap-2.5">
          {DEMO_CODES.map((d) => (
            <button
              key={d.code}
              type="button"
              disabled={busy}
              onClick={() => { setCode(d.code); void submit(d.code); }}
              className="chip min-h-11"
            >
              {t(d.labelKey)}
            </button>
          ))}
        </div>
        <p className="mt-3 text-sm leading-relaxed text-ink-3">{t("verify.where")}</p>
      </section>

      {/* QR vs barcode policy */}
      <section aria-label={t("verify.qrPolicyTitle")} className="card mt-6 p-5 md:p-6">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <QrCode className="size-5 text-primary" aria-hidden />
          {t("verify.qrPolicyTitle")}
        </h2>
        <p className="mt-2 text-base leading-relaxed text-ink-2">{t("verify.qrPolicy")}</p>
        <p className="mt-3 flex items-start gap-2 text-sm text-ink-3">
          <Barcode className="mt-0.5 size-4 shrink-0" aria-hidden />
          {t("barcode.hint")}
        </p>
      </section>
    </div>
  );
}
