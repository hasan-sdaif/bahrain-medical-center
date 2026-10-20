"use client";
/**
 * DomainBar — the single slim system chrome bar for the whole app (agent 2-a
 * re-skin): navy-900, ~44px, sticky. Merges the old DomainBar + the
 * LanguageAndTheme row into ONE bar: Shamel mark + system name, the 7 domain
 * pills (active = teal solid), and the language / theme toggles at the end.
 * Mirrors the production multi-domain architecture (website.bh & friends);
 * each "domain" is an isolated client module + dedicated API namespace.
 */
import { useTheme } from "next-themes";
import { Languages, Moon, Sun } from "lucide-react";
import { useApp, DOMAINS } from "@/store/app";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import { ShamelMark } from "@/components/shell/brand";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  BadgeCheck, ClipboardList, Hospital, MonitorPlay, ShieldCheck, Stethoscope, UserRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  public: Hospital, patient: UserRound, staff: Stethoscope, admin: ShieldCheck,
  kiosk: ClipboardList, queue: MonitorPlay, verify: BadgeCheck,
};

const pill =
  "flex h-8 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-bold whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-white/60";

export function DomainBar() {
  const { domain, setDomain, lang, setLang } = useApp();
  const { t } = useI18n();
  const { theme, setTheme } = useTheme();

  return (
    <TooltipProvider delayDuration={200}>
      <nav
        aria-label={t("shell.domains.label")}
        className="no-print sticky top-0 z-50 border-b border-white/10 bg-navy-900 text-white shadow-sm"
      >
        <div className="mx-auto flex h-11 max-w-[1600px] items-center gap-2 px-3 md:px-5">
          <button
            onClick={() => setDomain("public")}
            className="flex min-w-0 shrink-0 items-center gap-2 outline-none focus-visible:ring-2 focus-visible:ring-white/60 rounded-lg"
            aria-label={`${t("shell.app.name")} — ${t("shell.domain.public")}`}
          >
            <ShamelMark size={26} />
            <span className="hidden text-xs font-extrabold tracking-wide sm:block" style={{ fontFamily: "var(--font-cairo)" }}>
              {t("shell.system.name")}
            </span>
          </button>

          <div className="min-w-3 flex-1" />

          <div
            role="tablist"
            aria-label={t("shell.domains.label")}
            className="flex items-center gap-1 overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {DOMAINS.map((d) => {
              const Icon = ICONS[d.key];
              const active = domain === d.key;
              return (
                <Tooltip key={d.key}>
                  <TooltipTrigger asChild>
                    <button
                      role="tab"
                      aria-selected={active}
                      onClick={() => setDomain(d.key)}
                      className={cn(
                        pill,
                        active
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-white/70 hover:bg-white/10 hover:text-white",
                      )}
                    >
                      <Icon aria-hidden className="size-3.5 shrink-0" />
                      <span className="hidden xl:inline">{t(`shell.domain.${d.key}`)}</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    <span dir="ltr" className="font-mono">{d.host}</span> — {t("shell.domain.hint")}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>

          <span aria-hidden className="mx-1 hidden h-5 w-px shrink-0 bg-white/15 sm:block" />

          <div className="flex shrink-0 items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setLang(lang === "ar" ? "en" : "ar")}
                  aria-label="switch language"
                  className={cn(pill, "text-white/70 hover:bg-white/10 hover:text-white")}
                >
                  <Languages aria-hidden className="size-3.5 shrink-0" />
                  <span className="hidden sm:inline">{t("shell.session.lang")}</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">{t("shell.session.lang")}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  aria-label="toggle theme"
                  className={cn(pill, "w-8 justify-center px-0 text-white/70 hover:bg-white/10 hover:text-white")}
                >
                  {theme === "dark" ? <Sun aria-hidden className="size-4" /> : <Moon aria-hidden className="size-4" />}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                {theme === "dark" ? t("shell.theme.light") : t("shell.theme.dark")}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </nav>
    </TooltipProvider>
  );
}
