"use client";
/**
 * shell-login.tsx — StaffLogin on the Shamel auth-shell (doctor/login.html):
 * teal-navy gradient + diamond pattern, centered auth-card (ac-wide) with the
 * Shamel mark, MFA note, and the role-grouped demo accounts as list-items.
 * Same logic as before: click = setStaff(...) + warm /api/staff/me/modules.
 */
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, KeyRound, Loader2 } from "lucide-react";
import { useApp } from "@/store/app";
import { useI18n } from "@/i18n";
import { apiGet } from "@/lib/api-client";
import { Skeleton } from "@/components/ui/skeleton";
import { ShamelMark } from "@/components/shell/brand";
import { avClassOf, initialsOf, LangThemeButtons } from "./shell-identity";

interface LoginOption {
  id: string;
  role: string;
  nameAr: string;
  nameEn: string;
  deptAr: string | null;
  deptCode: string | null;
}

export function StaffLogin() {
  const { t, lang } = useI18n();
  const { setStaff, setDomain } = useApp();
  const [options, setOptions] = useState<LoginOption[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    apiGet<LoginOption[]>("/api/staff/login-options").then(setOptions).catch(() => setOptions([]));
  }, []);

  const grouped = useMemo(() => {
    const g = new Map<string, LoginOption[]>();
    for (const o of options ?? []) {
      const list = g.get(o.role) ?? [];
      list.push(o);
      g.set(o.role, list);
    }
    return [...g.entries()];
  }, [options]);

  const login = (o: LoginOption) => {
    setBusy(o.id);
    setStaff({ employeeId: o.id, role: o.role, nameAr: o.nameAr, nameEn: o.nameEn, departmentId: null });
    apiGet("/api/staff/me/modules").catch(() => null);
  };

  const BackArrow = lang === "ar" ? ArrowRight : ArrowLeft;
  const GoChevron = lang === "ar" ? ChevronLeft : ChevronRight;

  return (
    <div className="smc-staff-shell">
      <div className="auth-shell min-h-[calc(100dvh-3.5rem)]">
        <button
          type="button"
          onClick={() => setDomain("public")}
          className="auth-back gap-2 rounded-xl px-3 min-h-11"
        >
          <BackArrow className="size-4" aria-hidden />
          {t("staff.auth.back")}
        </button>
        <div className="absolute top-5 z-[2] flex items-center gap-2" style={{ insetInlineEnd: 22 }}>
          <LangThemeButtons tone="glass" />
        </div>

        <div className="auth-card ac-wide">
          <div className="auth-brand">
            <ShamelMark size={64} className="mx-auto mb-2 block" />
            <div className="mb-1 font-[family-name:var(--font-cairo)] font-extrabold text-[length:var(--fs-md)] text-ink">
              {t("shell.app.name")}
            </div>
            <h1 className="auth-title">{t("staff.auth.title")}</h1>
            <p className="auth-sub">{t("staff.auth.sub")}</p>
          </div>

          {!options ? (
            <div className="rounded-[var(--r-lg)] border border-line bg-surface-2/60 p-2 grid gap-2" aria-busy="true">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : options.length === 0 ? (
            <div className="rounded-[var(--r-lg)] border border-line bg-surface-2/60 p-6 text-center text-sm text-ink-2">
              {t("staff.auth.empty")}
            </div>
          ) : (
            <div className="rounded-[var(--r-lg)] border border-line bg-surface-2/60 overflow-hidden">
              <div className="flex items-center gap-2 border-b border-line bg-surface px-4 py-2.5">
                <KeyRound className="size-3.5 text-ink-3" aria-hidden />
                <span className="text-[length:var(--fs-xs)] font-bold tracking-wide text-ink-3">{t("staff.auth.accounts")}</span>
                <span className="badge sm b-teal ms-auto">{t("staff.auth.count", { n: options.length })}</span>
              </div>
              <p className="px-4 pt-2.5 text-[length:var(--fs-xs)] text-ink-3">{t("staff.auth.pickHint")}</p>
              <div className="max-h-[44vh] overflow-y-auto p-2">
                {grouped.map(([role, list]) => (
                  <div key={role} className="mb-1">
                    <div className="px-3 pt-2 pb-1 text-[11px] font-bold tracking-wider text-ink-3">{t(`staff.role.${role}`)}</div>
                    <div className="list-group">
                      {list.map((o) => {
                        const name = lang === "ar" ? o.nameAr : o.nameEn;
                        return (
                          <button
                            key={o.id}
                            type="button"
                            onClick={() => login(o)}
                            disabled={busy === o.id}
                            className="list-item w-full cursor-pointer text-start"
                          >
                            <span className={`avatar ${avClassOf(o.id)}`} aria-hidden>{initialsOf(name)}</span>
                            <span className="li-body">
                              <span className="li-title truncate">{name}</span>
                              <span className="li-sub truncate">{lang === "ar" ? (o.deptAr ?? "—") : (o.deptCode ?? "—")}</span>
                            </span>
                            <span className="li-end">
                              {o.deptCode && <span className="badge sm outline mono">{o.deptCode}</span>}
                              {busy === o.id
                                ? <Loader2 className="size-4 animate-spin text-ink-3" aria-hidden />
                                : <GoChevron className="size-4 text-ink-3" aria-hidden />}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="auth-foot">{t("staff.auth.foot")}</div>
        </div>

        <div className="num absolute bottom-5 inset-x-0 text-center text-xs text-white/55">staff.website.bh</div>
      </div>
    </div>
  );
}
