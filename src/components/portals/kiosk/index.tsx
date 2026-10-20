"use client";
/**
 * kiosk.website.bh — Shamel guide full-screen self check-in kiosk:
 * teal-navy .kiosk-shell (brand head + BH clock + language) → welcome tiles →
 * scan/CPR → .entry-ticket celebration (auto-reset 15s) | friendly glass error.
 */
import { useCallback, useEffect, useState } from "react";
import { CircleAlert, Clock, Languages, LifeBuoy } from "lucide-react";
import { useI18n } from "@/i18n";
import { apiGet, apiPost } from "@/lib/api-client";
import { ShamelAccent, ShamelMark } from "@/components/shell/brand";
import { bhTimeString } from "@/lib/bahrain";
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
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    apiGet<DemoOption[]>("/api/patient/login-options")
      .then((rows) => setDemos(rows.slice(0, 3)))
      .catch(() => setDemos([]));
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
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
    <div className="kiosk-shell min-h-[calc(100dvh-10.5rem)] rounded-none">
      <ShamelAccent />

      <header className="kiosk-head py-5">
        <ShamelMark size={44} />
        <div className="min-w-0">
          <p className="font-[family-name:var(--font-cairo)] text-lg font-extrabold leading-tight text-white md:text-xl">
            {t("shell.app.name")}
          </p>
          <p className="text-sm text-white/70">{t("kiosk.title")}</p>
        </div>
        <span dir="ltr" className="num ms-auto text-xl font-bold md:text-2xl" aria-label={t("admin.header.clock")}>
          {bhTimeString(now)}
        </span>
        <button
          type="button"
          onClick={() => setLang(lang === "ar" ? "en" : "ar")}
          aria-label={t("common.language")}
          className="inline-flex h-11 min-w-11 items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 text-sm font-bold text-white transition hover:bg-white/20"
        >
          <Languages className="size-5" aria-hidden />
          <span className="hidden sm:inline">{t("shell.session.lang")}</span>
        </button>
      </header>

      <div className="kiosk-body">
        {result ? (
          <CheckinSuccess result={result} onDone={reset} />
        ) : (
          <div className="grid w-full max-w-2xl justify-items-center gap-5">
            <CheckinForm key={formKey} busy={busy} error={error} onSubmit={submit} />

            {/* friendly error banner (glass card below the active card) */}
            {error && (
              <div
                role="alert"
                aria-live="assertive"
                className="w-full rounded-2xl border border-amber-300/50 bg-amber-400/15 p-5 text-start text-white animate-in fade-in slide-in-from-bottom-2"
              >
                <div className="flex items-start gap-4">
                  {error === "TOO_EARLY"
                    ? <Clock className="size-9 shrink-0 text-amber-200" aria-hidden />
                    : <CircleAlert className="size-9 shrink-0 text-amber-200" aria-hidden />}
                  <div>
                    <p className="text-lg font-extrabold">{t("kiosk.errTitle")}</p>
                    <p className="mt-1 text-base leading-relaxed text-white/85">
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
            <section
              aria-label={t("kiosk.demo")}
              className="w-full rounded-2xl border border-dashed border-teal-300/50 bg-white/[.06] p-4"
            >
              <p className="mb-3 flex items-center gap-2 text-sm font-bold text-teal-200">
                <LifeBuoy className="size-4" aria-hidden />
                {t("kiosk.demo")}
              </p>
              <div className="flex flex-wrap gap-2.5">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => submit({ cpr: DEMO_CPR })}
                  className="min-h-11 rounded-xl border border-teal-200/40 bg-white/10 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/20 active:scale-95 disabled:opacity-50"
                >
                  {t("kiosk.demoCpr")}
                </button>
                {(demos ?? []).slice(0, 2).map((o) => (
                  <button
                    key={o.mrn}
                    type="button"
                    disabled={busy}
                    onClick={() => submit({ mrn: o.mrn })}
                    className="min-h-11 rounded-xl border border-teal-200/40 bg-white/10 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/20 active:scale-95 disabled:opacity-50"
                  >
                    {t("kiosk.demoMrn", { mrn: o.mrn, name: bi(o) })}
                  </button>
                ))}
                {demos === null && <Skeleton className="h-11 w-56 rounded-xl bg-white/10" />}
              </div>
              <p className="mt-3 text-xs leading-relaxed text-white/60" dir="auto">{t("kiosk.demoBarcodeNote")}</p>
            </section>
          </div>
        )}
      </div>

      <footer className="kiosk-foot">
        <span>{t("kiosk.footPrivacy")}</span>
        <span dir="ltr" className="num">KIOSK-01 · v1.0</span>
      </footer>
    </div>
  );
}
