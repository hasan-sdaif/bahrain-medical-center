"use client";
/**
 * Verification result card — green shield (valid: type, bilingual title,
 * issued date, doctor + license, expiry) or red (invalid/revoked + guidance).
 */
import { BadgeCheck, CalendarCheck, ShieldX, Stethoscope } from "lucide-react";
import { useI18n, bi } from "@/i18n";
import { bhDateString } from "@/lib/bahrain";
import { Button } from "@/components/ui/button";

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
    <div className="rounded-2xl border bg-background/60 p-4">
      <p className="text-sm font-semibold text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-bold leading-snug">{value}</p>
    </div>
  );
}

export function VerifyResultCard({ result, onReset }: { result: VerifyResult; onReset: () => void }) {
  const { t, lang } = useI18n();

  if (!result.valid) {
    return (
      <div
        role="alert"
        className="animate-in fade-in zoom-in-95 rounded-3xl border-2 border-red-400 bg-red-50 p-6 text-red-800 dark:bg-red-950/40 dark:text-red-100 md:p-8"
      >
        <div className="flex items-center gap-4">
          <ShieldX className="size-14 shrink-0 text-red-500" aria-hidden />
          <h3 className="text-2xl font-black md:text-3xl">{t("verify.invalidTitle")}</h3>
        </div>
        <p className="mt-4 text-lg leading-relaxed">{t("verify.invalidHelp")}</p>
        <Button
          variant="outline"
          className="mt-5 h-12 rounded-xl border-red-300 px-6 text-base font-bold text-red-700 hover:bg-red-100 dark:text-red-100 dark:hover:bg-red-900/40"
          onClick={onReset}
        >
          {t("verify.tryAgain")}
        </Button>
      </div>
    );
  }

  const kindLabel = result.kind && (KINDS as readonly string[]).includes(result.kind)
    ? t(`verify.kind.${result.kind}`)
    : (result.kind ?? "—");

  return (
    <div
      role="status"
      className="animate-in fade-in zoom-in-95 rounded-3xl border-2 border-emerald-400 bg-emerald-50 p-6 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50 md:p-8"
    >
      <div className="flex items-center gap-4">
        <BadgeCheck className="size-14 shrink-0 text-emerald-500" aria-hidden />
        <h3 className="text-2xl font-black md:text-3xl">{t("verify.validTitle")}</h3>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Field label={t("verify.kind")} value={kindLabel} />
        <Field label={t("verify.docTitle")} value={bi(lang, result.titleAr, result.titleEn)} />
        <Field
          label={t("verify.issuedOn")}
          value={(
            <span dir="ltr" className="inline-flex items-center gap-2">
              <CalendarCheck className="size-5 text-emerald-500" aria-hidden />
              {result.issuedAt ? bhDateString(result.issuedAt) : "—"}
            </span>
          )}
        />
        <Field
          label={t("verify.doctor")}
          value={(
            <span className="inline-flex flex-wrap items-center gap-2">
              <Stethoscope className="size-5 text-emerald-500" aria-hidden />
              {result.doctorNameAr ?? "—"}
              <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                {t("verify.license")}: <span dir="ltr" className="font-mono">{result.doctorLicense ?? "—"}</span>
              </span>
            </span>
          )}
        />
        <Field
          label={t("verify.expires")}
          value={result.expiresAt ? <span dir="ltr">{bhDateString(result.expiresAt)}</span> : t("verify.noExpiry")}
        />
      </div>

      <Button
        variant="outline"
        className="mt-5 h-12 rounded-xl border-emerald-300 px-6 text-base font-bold text-emerald-700 hover:bg-emerald-100 dark:text-emerald-100 dark:hover:bg-emerald-900/40"
        onClick={onReset}
      >
        {t("verify.tryAgain")}
      </Button>
    </div>
  );
}
