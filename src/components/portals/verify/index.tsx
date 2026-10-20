"use client";
/**
 * verify.website.bh — public document verification.
 * Code input (mono, uppercase, auto-formats BMC-XXXX…) → POST /api/verify/check.
 * Demo chips use the deterministic seeded codes (computed offline — sha256("doc1")
 * / sha256("doc2") are server-side constants, never imported client-side).
 */
import { useCallback, useRef, useState } from "react";
import { Barcode, Building2, QrCode, ShieldCheck } from "lucide-react";
import { useI18n } from "@/i18n";
import { apiPost } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
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
      {/* identity */}
      <header className="text-center">
        <div className="mx-auto grid size-16 place-items-center rounded-3xl bg-primary text-primary-foreground shadow-lg">
          <ShieldCheck className="size-9" aria-hidden />
        </div>
        <h1 className="mt-4 text-3xl font-black md:text-4xl">{t("verify.title")}</h1>
        <p className="mx-auto mt-2 max-w-lg text-base text-muted-foreground md:text-lg">{t("verify.subtitle")}</p>
        <p className="mt-1 inline-flex items-center gap-2 text-sm text-muted-foreground">
          <Building2 className="size-4" aria-hidden /> {t("shell.app.name")}
        </p>
      </header>

      {/* code form */}
      <form
        className="mt-8 grid gap-3 sm:grid-[1fr_auto]"
        onSubmit={(e) => { e.preventDefault(); void submit(code); }}
      >
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
          className="h-14 w-full rounded-2xl border-2 border-input bg-background px-5 font-mono text-xl font-semibold uppercase tracking-wider transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
        />
        <Button
          type="submit"
          size="lg"
          disabled={busy || formatCode(code).length < 10}
          className="h-14 rounded-2xl px-8 text-lg font-bold"
        >
          {busy ? t("verify.checking") : t("verify.submit")}
        </Button>
      </form>

      {/* result */}
      <div aria-live="polite" className="mt-6 grid gap-4">
        {busy && <Skeleton className="h-40 rounded-3xl" />}
        {!busy && failed && (
          <p role="alert" className="rounded-2xl border border-amber-400/60 bg-amber-50 dark:bg-amber-950/40 px-5 py-4 text-lg font-semibold text-amber-800 dark:text-amber-100">
            {t("verify.errGeneric")}
          </p>
        )}
        {!busy && result && <VerifyResultCard result={result} onReset={reset} />}
      </div>

      {/* demo chips — clearly labelled */}
      <section aria-label={t("verify.demo")} className="mt-8 rounded-3xl border-2 border-dashed border-primary/50 bg-primary/5 p-5">
        <p className="text-sm font-bold text-primary">{t("verify.demo")}</p>
        <div className="mt-3 flex flex-wrap gap-3">
          {DEMO_CODES.map((d) => (
            <button
              key={d.code}
              type="button"
              disabled={busy}
              onClick={() => { setCode(d.code); void submit(d.code); }}
              className="min-h-11 rounded-xl border border-primary/40 bg-background px-4 py-2 text-base font-semibold shadow-sm transition hover:scale-[1.02] active:scale-95 disabled:opacity-50"
            >
              {t(d.labelKey)}
            </button>
          ))}
        </div>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{t("verify.where")}</p>
      </section>

      {/* QR vs barcode policy */}
      <section aria-label={t("verify.qrPolicyTitle")} className="mt-6 rounded-3xl border bg-card p-5 md:p-6">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <QrCode className="size-5 text-primary" aria-hidden />
          {t("verify.qrPolicyTitle")}
        </h2>
        <p className="mt-2 text-base leading-relaxed text-muted-foreground">{t("verify.qrPolicy")}</p>
        <p className="mt-3 flex items-start gap-2 text-sm text-muted-foreground">
          <Barcode className="mt-0.5 size-4 shrink-0" aria-hidden />
          {t("barcode.hint")}
        </p>
      </section>
    </div>
  );
}
