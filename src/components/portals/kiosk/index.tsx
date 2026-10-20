"use client";
/**
 * kiosk.website.bh — كشك الحضور الذاتي (full-screen self check-in).
 * Flow: input (barcode scan | CPR keypad) → POST /api/kiosk/check-in →
 * full-screen ticket celebration (auto-reset 15s) | friendly error card.
 */
import { useCallback, useEffect, useState } from "react";
import { Building2, CircleAlert, Clock, Languages, LifeBuoy } from "lucide-react";
import { useI18n } from "@/i18n";
import { apiGet, apiPost } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import CheckinForm, { type CheckinPayload } from "./checkin-form";
import CheckinSuccess from "./success";

export interface KioskResult {
  ok: boolean;
  ticket: { code: string };
  room: string;
  mrn: string;
  idMasked: string;
}
export type KioskErrorKind = "TOO_EARLY" | "NOT_FOUND" | "CPR" | "GENERIC";

interface DemoOption { mrn: string; nameAr: string; nameEn: string }

const DEMO_CPR = "812030501";

export default function KioskPortal() {
  const { t, lang, setLang } = useI18n();
  const [result, setResult] = useState<KioskResult | null>(null);
  const [error, setError] = useState<KioskErrorKind | null>(null);
  const [busy, setBusy] = useState(false);
  const [demos, setDemos] = useState<DemoOption[] | null>(null);
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    apiGet<DemoOption[]>("/api/patient/login-options")
      .then((rows) => setDemos(rows.slice(0, 3)))
      .catch(() => setDemos([]));
  }, []);

  const submit = useCallback(async (payload: CheckinPayload) => {
    setBusy(true);
    setError(null);
    try {
      const r = await apiPost<KioskResult>("/api/kiosk/check-in", payload);
      setResult(r);
    } catch (e) {
      const err = e as { problem?: { code?: string }; status?: number };
      const code = String(err?.problem?.code ?? "");
      setError(
        code === "TOO_EARLY" ? "TOO_EARLY"
          : code === "ID_INVALID_CPR" ? "CPR"
            : code === "NOT_FOUND" ? "NOT_FOUND"
              : "GENERIC",
      );
    } finally {
      setBusy(false);
    }
  }, []);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
    setFormKey((k) => k + 1);
  }, []);

  const bi = (o: DemoOption) => (lang === "ar" ? o.nameAr : o.nameEn);

  return (
    <div className="min-h-[calc(100dvh-11rem)] flex flex-col bg-gradient-to-b from-primary/10 via-background to-emerald-500/10">
      {/* kiosk chrome: center identity + big bilingual toggle */}
      <header className="flex items-center gap-4 px-6 md:px-10 pt-6">
        <div className="grid size-14 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
          <Building2 className="size-7" aria-hidden />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-bold leading-tight truncate">{t("shell.app.name")}</h1>
          <p className="text-sm md:text-base text-muted-foreground">{t("kiosk.title")} · {t("kiosk.welcome")}</p>
        </div>
        <Button
          variant="outline"
          className="ms-auto h-14 px-6 text-lg font-semibold gap-2 rounded-2xl"
          onClick={() => setLang(lang === "ar" ? "en" : "ar")}
          aria-label={t("common.language")}
        >
          <Languages className="size-5" aria-hidden />
          {t("shell.session.lang")}
        </Button>
      </header>

      {result ? (
        <CheckinSuccess result={result} onDone={reset} />
      ) : (
        <>
          <CheckinForm
            key={formKey}
            busy={busy}
            error={error}
            onSubmit={submit}
          />

          {/* friendly error banner (below the active card, large type) */}
          {error && (
            <div
              role="alert"
              aria-live="assertive"
              className="mx-auto w-full max-w-3xl px-6 md:px-10 pb-2"
            >
              <div className="flex items-start gap-4 rounded-3xl border-2 border-amber-400/70 bg-amber-50 dark:bg-amber-950/40 p-5 md:p-6 text-amber-900 dark:text-amber-100 shadow-lg animate-in fade-in slide-in-from-bottom-2">
                {error === "TOO_EARLY" ? <Clock className="size-10 shrink-0" aria-hidden /> : <CircleAlert className="size-10 shrink-0" aria-hidden />}
                <div>
                  <p className="text-xl md:text-2xl font-bold">{t("kiosk.errTitle")}</p>
                  <p className="text-lg md:text-xl leading-relaxed mt-1">
                    {error === "TOO_EARLY" ? t("kiosk.errTooEarly")
                      : error === "NOT_FOUND" ? t("kiosk.errNotFound")
                        : error === "CPR" ? t("kiosk.errCpr")
                          : t("kiosk.errGeneric")}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* demo helper chips — clearly labelled */}
          <section aria-label={t("kiosk.demo")} className="mx-auto w-full max-w-3xl px-6 md:px-10 pb-8 mt-auto pt-4">
            <div className="rounded-3xl border-2 border-dashed border-emerald-500/60 bg-emerald-50/60 dark:bg-emerald-950/30 p-4 md:p-5">
              <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300 mb-3 flex items-center gap-2">
                <LifeBuoy className="size-4" aria-hidden />
                {t("kiosk.demo")}
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => submit({ cpr: DEMO_CPR })}
                  className="min-h-11 rounded-xl border border-emerald-500/50 bg-background px-4 py-2 text-base font-semibold shadow-sm transition hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                >
                  {t("kiosk.demoCpr")}
                </button>
                {(demos ?? []).slice(0, 2).map((o) => (
                  <button
                    key={o.mrn}
                    type="button"
                    disabled={busy}
                    onClick={() => submit({ mrn: o.mrn })}
                    className="min-h-11 rounded-xl border border-emerald-500/50 bg-background px-4 py-2 text-base font-semibold shadow-sm transition hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                  >
                    {t("kiosk.demoMrn", { mrn: o.mrn, name: bi(o) })}
                  </button>
                ))}
                {demos === null && <Skeleton className="h-11 w-56 rounded-xl" />}
              </div>
              <p className="mt-3 text-sm text-muted-foreground" dir="auto">{t("kiosk.demoBarcodeNote")}</p>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
