"use client";
/**
 * shell-identity.tsx — shared primitives for the Shamel staff shell:
 * demo-account identity helpers (initials + avatar color), the scoped shell
 * style (hides the global lang/theme bar while the staff portal is mounted —
 * the shell ships its own compact toggles), and those compact toggles.
 */
import { useTheme } from "next-themes";
import { Languages, Moon, Sun } from "lucide-react";
import { useApp } from "@/store/app";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";

/** "د. خالد المنصوري" → "خ م" / "Dr. Layla Al-Mousawi" → "L M". */
export function initialsOf(name: string): string {
  const parts = name
    .replace(/^(?:د\.|دكتورة|أ\.|م\.|Dr\.?|Mr\.?|Ms\.?)\s*/i, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "—";
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).trim() || (name[0] ?? "—");
}

/** Stable avatar tint (av-1 … av-8) from a demo id. */
export function avClassOf(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return `av-${(h % 8) + 1}`;
}

/**
 * Scoped shell style: while the staff portal is mounted (`.smc-staff-shell`
 * on its root), the global language/theme strip rendered by the page shell
 * is hidden — the staff topbar and auth screen carry their own toggles.
 * The domain switcher stays visible (it is the only way across portals).
 */
export function ShellStyle() {
  return (
    <style>{`
body:has(.smc-staff-shell) .no-print.sticky.top-14{display:none!important}
/* ── Preflight bridge ─────────────────────────────────────────────────────
   Tailwind v4's base preflight (*{margin:0;padding:0;border:0 solid}) lives
   in a cascade layer declared AFTER @layer shamel, so it zeroes every Shamel
   margin/padding/border (verified: .nav-item/.content/.topbar computed 0).
   These unlayered rules — unlayered beats every layer — restore the guide's
   exact values for the classes the staff shell + auth screen use. Scoped to
   .smc-staff-shell; remove once globals.css declares the shamel layer after
   the tailwind base layer. */
.smc-staff-shell .sidebar{border-inline-end:1px solid var(--border)}
.smc-staff-shell .app-main{margin-inline-start:var(--sidebar-w)}
body.side-collapsed .smc-staff-shell .app-main{margin-inline-start:var(--sidebar-w-min)}
@media (max-width:1180px){.smc-staff-shell .app-main{margin-inline-start:0!important}}
.smc-staff-shell .sidebar-brand{padding:18px 20px;border-bottom:1px solid var(--border)}
.smc-staff-shell .sidebar-scroll{padding:14px 14px 20px}
.smc-staff-shell .nav-group{margin-bottom:6px}
.smc-staff-shell .nav-group-title{padding:14px 12px 6px}
.smc-staff-shell .nav-item{padding:10px 12px;margin-bottom:2px}
.smc-staff-shell .nav-badge{padding:2px 7px;margin-inline-start:auto}
.smc-staff-shell .list-item:last-child{border-bottom:none}
.smc-staff-shell .sidebar-foot{padding:12px 14px;border-top:1px solid var(--border)}
body.side-collapsed .smc-staff-shell .sidebar-brand{padding-inline:0}
body.side-collapsed .smc-staff-shell .nav-item{padding-inline:0}
.smc-staff-shell .topbar{padding-inline:22px;border-bottom:1px solid var(--border)}
.smc-staff-shell .topbar-actions{margin-inline-start:auto}
.smc-staff-shell .topbar-search input{padding-inline:46px 16px;border:1px solid var(--border)}
.smc-staff-shell .subdomain-chip{padding:5px 12px;border:1px solid var(--border)}
.smc-staff-shell .clock-chip{padding:6px 14px;border:1px solid var(--border)}
.smc-staff-shell .content{padding:26px 26px 60px}
.smc-staff-shell .btn{padding:0 20px;border:1px solid var(--btn-bd)}
.smc-staff-shell .btn.btn-sm{padding:0 14px}
.smc-staff-shell .btn.btn-icon{padding:0}
.smc-staff-shell kbd{padding:.1em .45em;border:1px solid var(--border-2);border-bottom-width:2px}
.smc-staff-shell .badge{padding:4px 11px}
.smc-staff-shell .badge.sm{padding:2px 8px}
.smc-staff-shell .badge.outline{border:1px solid currentColor}
.smc-staff-shell .list-item{padding:13px 18px;border-bottom:1px solid var(--border)}
.smc-staff-shell .list-item .li-sub{margin-top:2px}
.smc-staff-shell .auth-shell{padding:40px 20px}
.smc-staff-shell .auth-card{padding:40px 38px 34px}
.smc-staff-shell .auth-brand{margin-bottom:26px}
.smc-staff-shell .auth-title{margin-bottom:6px}
.smc-staff-shell .auth-sub{margin-bottom:26px}
.smc-staff-shell .auth-foot{margin-top:22px;padding-top:20px;border-top:1px dashed var(--border-2)}
.smc-staff-shell .drop-menu{padding:7px;border:1px solid var(--border)}
.smc-staff-shell .drop-header{padding:9px 12px 6px}
.smc-staff-shell .notif-item{padding:13px 12px}
.smc-staff-shell .notif-item .ni-sub{margin-top:2px}
.smc-staff-shell .page-head{margin-bottom:24px}
.smc-staff-shell .page-head .page-sub{margin-top:4px}
@media (max-width:760px){
  .smc-staff-shell .content{padding:18px 16px 44px}
  .smc-staff-shell .topbar{padding-inline:14px}
  .smc-staff-shell .auth-card{padding:30px 22px 26px}
}
`}</style>
  );
}

/** Compact language + theme icon buttons. tone="glass" for the auth gradient. */
export function LangThemeButtons({ tone = "bar" }: { tone?: "bar" | "glass" }) {
  const { lang, setLang } = useApp();
  const { t } = useI18n();
  const { theme, setTheme } = useTheme();
  const glass = tone === "glass";
  return (
    <>
      <button
        type="button"
        onClick={() => setLang(lang === "ar" ? "en" : "ar")}
        aria-label={t("shell.session.lang")}
        title="English / العربية"
        className={cn(
          "grid shrink-0 place-items-center transition-colors",
          glass
            ? "size-11 rounded-xl border border-white/25 bg-white/10 text-white/90 hover:bg-white/20"
            : "btn btn-ghost btn-icon",
        )}
      >
        <Languages className="size-5" aria-hidden />
      </button>
      <button
        type="button"
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        aria-label={theme === "dark" ? t("shell.theme.light") : t("shell.theme.dark")}
        title={theme === "dark" ? t("shell.theme.light") : t("shell.theme.dark")}
        className={cn(
          "grid shrink-0 place-items-center transition-colors",
          glass
            ? "size-11 rounded-xl border border-white/25 bg-white/10 text-white/90 hover:bg-white/20"
            : "btn btn-ghost btn-icon",
        )}
      >
        {theme === "dark" ? <Sun className="size-5" aria-hidden /> : <Moon className="size-5" aria-hidden />}
      </button>
    </>
  );
}
