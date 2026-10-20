"use client";
/**
 * Patient portal navigation — mobile bottom tab bar (4 primary + "more" sheet)
 * and desktop sidebar (all screens). Touch targets ≥44px.
 */
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  Bell, CalendarDays, FileSignature, FileText, FlaskConical, Home, LayoutGrid,
  Pill, Receipt, ShieldCheck, Syringe, Users, type LucideIcon,
} from "lucide-react";

export type PatientScreen =
  | "overview" | "appointments" | "results" | "prescriptions" | "invoices"
  | "consents" | "documents" | "messages" | "family" | "homedraw" | "privacy";

export interface NavItem { key: PatientScreen; icon: LucideIcon; labelKey: string; primary?: boolean }

export const NAV_ITEMS: NavItem[] = [
  { key: "overview", icon: Home, labelKey: "pp.nav.overview", primary: true },
  { key: "appointments", icon: CalendarDays, labelKey: "pp.nav.appointments", primary: true },
  { key: "results", icon: FlaskConical, labelKey: "pp.nav.results", primary: true },
  { key: "messages", icon: Bell, labelKey: "pp.nav.messages", primary: true },
  { key: "prescriptions", icon: Pill, labelKey: "pp.nav.prescriptions" },
  { key: "invoices", icon: Receipt, labelKey: "pp.nav.invoices" },
  { key: "consents", icon: FileSignature, labelKey: "pp.nav.consents" },
  { key: "documents", icon: FileText, labelKey: "pp.nav.documents" },
  { key: "family", icon: Users, labelKey: "pp.nav.family" },
  { key: "homedraw", icon: Syringe, labelKey: "pp.nav.homedraw" },
  { key: "privacy", icon: ShieldCheck, labelKey: "pp.nav.privacy" },
];
const PRIMARY = NAV_ITEMS.filter((n) => n.primary);
const REST = NAV_ITEMS.filter((n) => !n.primary);

function TabButton({ item, active, unread, onClick }: { item: NavItem; active: boolean; unread?: number; onClick: () => void }) {
  const { t } = useI18n();
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex min-h-[48px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1 text-[11px] font-medium transition-colors",
        active ? "text-primary" : "text-muted-foreground hover:text-foreground",
      )}
    >
      <span className="relative">
        <Icon className="size-5" aria-hidden />
        {unread ? (
          <span className="absolute -end-2 -top-1.5 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-4 text-white" aria-label={`${unread} ${t("pp.unread.badge")}`}>{unread > 9 ? "9+" : unread}</span>
        ) : null}
      </span>
      <span className="truncate">{t(item.labelKey)}</span>
      {active ? <span className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-primary" aria-hidden /> : null}
    </button>
  );
}

export function BottomNav({ screen, unread, onNavigate }: { screen: PatientScreen; unread: number; onNavigate: (s: PatientScreen) => void }) {
  const { t } = useI18n();
  return (
    <nav aria-label={t("shell.domain.patient")} className="sticky bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <div className="mx-auto flex max-w-2xl items-stretch px-1">
        {PRIMARY.map((item) => (
          <TabButton key={item.key} item={item} active={screen === item.key} unread={item.key === "messages" ? unread : undefined} onClick={() => onNavigate(item.key)} />
        ))}
        <Sheet>
          <SheetTrigger asChild>
            <button type="button" className={cn("relative flex min-h-[48px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1 text-[11px] font-medium", screen !== "overview" && screen !== "appointments" && screen !== "results" && screen !== "messages" ? "text-primary" : "text-muted-foreground")}>
              <LayoutGrid className="size-5" aria-hidden />
              <span className="truncate">{t("pp.nav.more")}</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="pb-[calc(env(safe-area-inset-bottom)+1rem)]">
            <SheetHeader><SheetTitle>{t("pp.nav.more")}</SheetTitle></SheetHeader>
            <div className="grid grid-cols-3 gap-2 pb-2">
              {REST.map((item) => {
                const Icon = item.icon;
                return (
                  <SheetTrigger key={item.key} asChild>
                    <button type="button" onClick={() => onNavigate(item.key)} className={cn("flex min-h-[72px] flex-col items-center justify-center gap-1.5 rounded-xl border p-2 text-xs font-medium transition-colors hover:bg-accent", screen === item.key && "border-primary/50 bg-primary/5 text-primary")}>
                      <Icon className="size-5" aria-hidden />
                      {t(item.labelKey)}
                    </button>
                  </SheetTrigger>
                );
              })}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}

export function SideNav({ screen, unread, onNavigate }: { screen: PatientScreen; unread: number; onNavigate: (s: PatientScreen) => void }) {
  const { t } = useI18n();
  return (
    <nav aria-label={t("shell.domain.patient")} className="sticky top-4 hidden max-h-[calc(100dvh-2rem)] w-56 shrink-0 flex-col gap-1 self-start rounded-2xl border bg-card p-2 md:flex">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const active = screen === item.key;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onNavigate(item.key)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-11 items-center gap-2.5 rounded-lg px-3 text-sm font-medium transition-colors",
              active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            <span className="truncate">{t(item.labelKey)}</span>
            {item.key === "messages" && unread ? (
              <span className="ms-auto flex min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-white">{unread > 9 ? "9+" : unread}</span>
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}
