"use client";
/**
 * Patient portal — demo login: pick a record from /api/patient/login-options
 * (name + MRN + masked phone), then setPatient() to open the session.
 * Shamel skin: `.auth-shell` gradient + pattern, `.auth-card`, `.cpr-input`
 * MRN quick-entry (filters / direct sign-in), demo accounts as `.list-group`.
 */
import { useState } from "react";
import { apiGet } from "@/lib/api-client";
import { useApp } from "@/store/app";
import { useI18n, bi } from "@/i18n";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { ErrorBox } from "./parts";
import { maskPhone, useFetch, type LoginOption } from "./lib";
import { ShamelMark } from "@/components/shell/brand";
import { LogIn, Phone, Search, UserRound } from "lucide-react";

export default function LoginScreen() {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const setPatient = useApp((s) => s.setPatient);
  const [mrn, setMrn] = useState("");
  const { data, loading, error, reload } = useFetch<LoginOption[]>(() => apiGet<LoginOption[]>("/api/patient/login-options"));

  const enter = async (row: LoginOption) => {
    // optimistic session (id + mrn + names) — overview fetch refines it right after
    useApp.getState().setPatient({ patientId: row.id, mrn: row.mrn, nameAr: row.nameAr, nameEn: row.nameEn });
    try {
      const { patient } = await apiGet<{ patient: { nameAr: string; nameEn: string } }>("/api/patient/overview");
      if (patient?.nameEn) useApp.getState().setPatient({ patientId: row.id, mrn: row.mrn, nameAr: patient.nameAr, nameEn: patient.nameEn });
    } catch {
      toast({ title: t("common.error"), description: t("common.retry"), variant: "destructive" });
    }
  };

  const digits = mrn.replace(/\D/g, "");
  const rows = (data ?? []).filter((r) =>
    !digits || r.mrn.includes(digits) || bi(lang, r.nameAr, r.nameEn).includes(mrn.trim()));
  const exact = digits.length >= 4 ? (data ?? []).find((r) => r.mrn === digits) : undefined;

  return (
    <div className="auth-shell min-h-[calc(100dvh-9.5rem)]">
      <div className="auth-card ac-wide">
        <div className="auth-brand">
          <ShamelMark size={64} className="brand-mark mx-auto" />
          <h1 className="auth-title">{t("pp.login.welcome")}</h1>
          <p className="auth-sub">{t("pp.login.subtitle")}</p>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); if (exact) void enter(exact); }}>
          <div className="field">
            <label className="field-label" htmlFor="pp-mrn">{t("pp.login.mrnField")}</label>
            <div className="input-icon">
              <span className="ii" aria-hidden><Search className="size-4" /></span>
              <input
                id="pp-mrn" className="input cpr-input" inputMode="numeric" autoComplete="off"
                placeholder="0 0 0 0 0 0 0 0" value={mrn} onChange={(e) => setMrn(e.target.value)}
                aria-describedby="pp-mrn-help"
              />
            </div>
            <p className="field-help" id="pp-mrn-help">{t("pp.login.mrnHelp")}</p>
          </div>
          {exact ? (
            <Button type="submit" className="mb-4 min-h-11 w-full">
              <LogIn className="size-4" aria-hidden />{t("pp.login.mrnEnter")} <span className="num" dir="ltr">{exact.mrn}</span>
            </Button>
          ) : null}
        </form>

        {loading ? (
          <div className="grid gap-2" aria-busy="true">
            {Array.from({ length: 4 }, (_, i) => <div key={i} className="skeleton sk-card h-16" />)}
          </div>
        ) : error ? (
          <ErrorBox error={error} onRetry={reload} />
        ) : (
          <div className="card">
            <div className="card-head">
              <div className="ch-title">
                <span className="ch-ic ic-teal" aria-hidden><UserRound className="size-4" /></span>
                <span>{t("pp.login.accounts")}</span>
              </div>
            </div>
            <div className="card-body p-0">
              <ul className="list-group max-h-96 overflow-y-auto" role="list">
                {rows.map((row, i) => (
                  <li key={row.id} className="list-item">
                    <span className={`avatar av-${(i % 8) + 1}`} aria-hidden>
                      {bi(lang, row.nameAr, row.nameEn).trim().charAt(0) || "P"}
                    </span>
                    <span className="li-body">
                      <span className="li-title">{bi(lang, row.nameAr, row.nameEn)}</span>
                      <span className="li-sub flex flex-wrap items-center gap-x-3 gap-y-0.5">
                        <span className="mono">{row.mrn}</span>
                        <span className="flex items-center gap-1" dir="ltr"><Phone className="size-3" aria-hidden />{maskPhone(row.phone)}</span>
                      </span>
                    </span>
                    <span className="li-end">
                      <Button
                        variant="outline" size="sm" className="min-h-11"
                        onClick={() => enter(row)}
                        aria-label={`${t("pp.login.select")} — ${bi(lang, row.nameAr, row.nameEn)}`}
                      >
                        <LogIn className="size-4" aria-hidden />{t("pp.login.select")}
                      </Button>
                    </span>
                  </li>
                ))}
                {!rows.length ? <li className="list-item"><span className="li-sub">{t("common.empty")}</span></li> : null}
              </ul>
            </div>
          </div>
        )}

        <div className="auth-foot">{t("pp.login.foot")}</div>
      </div>
      <span className="num absolute bottom-6 text-xs text-white/55" aria-hidden>patient.website.bh</span>
    </div>
  );
}
