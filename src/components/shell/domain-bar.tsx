"use client";
/**
 * DomainBar — the 7-audience switcher. Mirrors the production multi-domain
 * architecture (separate apps per audience with hard isolation); here each
 * "domain" is an isolated client module + dedicated API namespace.
 */
import { useApp, DOMAINS, type DomainKey } from "@/store/app";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import { BadgeCheck, ClipboardList, Hospital, MonitorPlay, ShieldCheck, Stethoscope, UserRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const ICONS: Record<DomainKey, LucideIcon> = {
  public: Hospital, patient: UserRound, staff: Stethoscope, admin: ShieldCheck, kiosk: ClipboardList, queue: MonitorPlay, verify: BadgeCheck,
};

export function DomainBar() {
  const { domain, setDomain } = useApp();
  const { t } = useI18n();
  return (
    <TooltipProvider delayDuration={150}>
      <nav aria-label={t("shell.domains.label")} className="no-print sticky top-0 z-40 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto max-w-[1600px] px-3 md:px-6 h-14 flex items-center gap-2 md:gap-3">
          <button
            onClick={() => setDomain("public")}
            className="flex items-center gap-2 shrink-0"
            aria-label={t("shell.app.name")}
          >
            <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">BMC</span>
            <span className="hidden sm:block text-sm font-semibold leading-tight text-start">
              {t("shell.app.name")}
              <span className="block text-[10px] font-normal text-muted-foreground leading-tight">{t("shell.app.tagline")}</span>
            </span>
          </button>
          <div className="flex-1" />
          <div role="tablist" aria-label={t("shell.domains.label")} className="flex items-center gap-1 overflow-x-auto">
            {DOMAINS.map((d) => (
              <Tooltip key={d.key}>
                <TooltipTrigger asChild>
                  <button
                    role="tab"
                    aria-selected={domain === d.key}
                    onClick={() => setDomain(d.key)}
                    className={cn(
                      "px-2.5 md:px-3 h-9 rounded-lg text-xs md:text-sm font-medium transition-colors whitespace-nowrap",
                      domain === d.key
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted",
                    )}
                  >
                    <ICONS[d.key] aria-hidden className="me-1 inline size-4" />
                    <span className="hidden md:inline">{t(`shell.domain.${d.key}`)}</span>
                    <span className="md:hidden">{t(`shell.domain.${d.key}`).split(" ")[0]}</span>
                    <span dir="ltr" className="ms-1.5 hidden lg:inline text-[10px] font-mono opacity-70">{d.host}</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">{d.host} — {t("shell.domain.hint")}</TooltipContent>
              </Tooltip>
            ))}
          </div>
        </div>
      </nav>
    </TooltipProvider>
  );
}
