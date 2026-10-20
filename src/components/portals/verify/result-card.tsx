"use client";
/**
 * Verification result (Shamel guide): .alert-success summary + document
 * details card (type / title / issued / doctor + license / expiry) with a
 * print action (.print-area), or .alert-danger guidance for invalid codes.
 */
import { BadgeCheck, CalendarCheck, Printer, RotateCcw, ShieldX, Stethoscope } from "lucide-react";
import { useI18n, bi } from "@/i18n";
import { bhDateString } from "@/lib/bahrain";

export interface VerifyResult {
  valid: boolean;
  kind?: string;
  titleAr?: string;
  titleEn?: string;
  issuedAt?: string;
  doctorNameAr?: string;
  doctorLicense?: string;
  expiresAt?: string | null;
  reason?: string;
}

const KINDS = ["report", "certificate", "sick-leave", "referral", "prescription"] as const;

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-surface-2 p-4">
      <p className="text-sm font-semibold text-ink-3">{label}</p>
      <p className="mt-1 text-base font-bold leading-snug text-ink">{value}</p>
    </div>
  );
}

export function VerifyResultCard({ result, onReset }: { result: VerifyResult; onReset: () => void }) {
  const { t, lang } = useI18n();

  if (!result.valid) {
    return (
      <div role="alert" className="alert alert-danger animate-in fade-in zoom-in-95 p-5 md:p-6">
        <span className="al-ic"><ShieldX className="size-7 text-red-600" aria-hidden /></span>
        <div className="min-w-0 flex-1">
          <p className="al-title text-lg md:text-xl">{t("verify.invalidTitle")}</p>
          <p className="leading-relaxed">{t("verify.invalidHelp")}</p>
          <button type="button" className="btn btn-outline btn-sm mt-4 h-9" onClick={onReset}>
            <RotateCcw className="size-4" aria-hidden />
            {t("verify.tryAgain")}
          </button>
        </div>
      </div>
    );
  }

  const kindLabel = result.kind && (KINDS as readonly string[]).includes(result.kind)
    ? t(`verify.kind.${result.kind}`)
    : (result.kind ?? "—");

  return (
    <div role="status" className="print-area grid gap-4 animate-in fade-in zoom-in-95">
      <div className="alert alert-success p-5 md:p-6">
        <span className="al-ic"><BadgeCheck className="size-8 text-green-600" aria-hidden /></span>
        <div>
          <p className="al-title text-lg md:text-xl">{t("verify.validTitle")}</p>
          <p className="leading-relaxed">
            {bi(lang, result.titleAr, result.titleEn)} · {kindLabel}
          </p>
        </div>
      </div>

      <div className="card p-0">
        <div className="card-head">
          <span className="ch-title">
            <span className="ch-ic"><CalendarCheck className="size-4" aria-hidden /></span>
            {t("verify.details")}
          </span>
        </div>
        <div className="card-body grid gap-3 sm:grid-cols-2">
          <Field label={t("verify.kind")} value={kindLabel} />
          <Field label={t("verify.docTitle")} value={bi(lang, result.titleAr, result.titleEn)} />
          <Field
            label={t("verify.issuedOn")}
            value={<span dir="ltr" className="num">{result.issuedAt ? bhDateString(result.issuedAt) : "—"}</span>}
          />
          <Field
            label={t("verify.doctor")}
            value={(
              <span className="flex flex-wrap items-center gap-2">
                <Stethoscope className="size-4 text-primary" aria-hidden />
                {result.doctorNameAr ?? "—"}
                <span className="text-xs font-semibold text-ink-3">
                  {t("verify.license")}: <span dir="ltr" className="mono">{result.doctorLicense ?? "—"}</span>
                </span>
              </span>
            )}
          />
          <Field
            label={t("verify.expires")}
            value={result.expiresAt ? <span dir="ltr" className="num">{bhDateString(result.expiresAt)}</span> : t("verify.noExpiry")}
          />
        </div>
        <div className="card-foot">
          <span className="cf-tools flex gap-2">
            <button type="button" className="btn btn-outline btn-sm h-9" onClick={() => window.print()}>
              <Printer className="size-4" aria-hidden />
              {t("verify.print")}
            </button>
            <button type="button" className="btn btn-soft btn-sm h-9" onClick={onReset}>
              <RotateCcw className="size-4" aria-hidden />
              {t("verify.tryAgain")}
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}
