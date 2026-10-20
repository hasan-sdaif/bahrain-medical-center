"use client";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n";
import { BHD3 } from "@/lib/money";

const TONES: Record<string, string> = {
  // appointments
  requested: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  confirmed: "bg-teal-100 text-teal-900 dark:bg-teal-950 dark:text-teal-200",
  arrived: "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200",
  "in-service": "bg-teal-100 text-teal-900 dark:bg-teal-950 dark:text-teal-200",
  completed: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  cancelled: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  "no-show": "bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200",
  rescheduled: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  // labs
  normal: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  H: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  L: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  CRIT: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200 animate-pulse",
  // queue
  waiting: "bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200",
  called: "bg-teal-100 text-teal-900 dark:bg-teal-950 dark:text-teal-200",
  serving: "bg-teal-600 text-white",
  done: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  // payments/claims
  paid: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  partial: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  issued: "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200",
  rejected: "bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200",
  submitted: "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200",
  approved: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  draft: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  signed: "bg-teal-100 text-teal-900 dark:bg-teal-950 dark:text-teal-200",
  // assets/maintenance
  operational: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  down: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200",
  "in-maintenance": "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  "awaiting-calibration": "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  "awaiting-part": "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  open: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  assigned: "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200",
  closed: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  active: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const { t } = useI18n();
  const tone = TONES[status] ?? "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";
  return <Badge variant="outline" className={cn("border-transparent font-medium", tone, className)}>{t(`status.${status}`)}</Badge>;
}

export function FlagBadges({ flags }: { flags: { kind: string; valueAr?: string | null; valueEn?: string | null; severity?: string | null }[] }) {
  const { t, lang } = useI18n();
  if (!flags?.length) return null;
  const toneFor = (sev?: string | null) =>
    sev === "critical" ? "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200"
      : sev === "warn" ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
        : "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";
  return (
    <span className="flex flex-wrap gap-1">
      {flags.map((f) => (
        <Badge key={f.kind} variant="outline" className={cn("border-transparent", toneFor(f.severity))}>
          {lang === "ar" ? f.valueAr ?? f.kind : f.valueEn ?? f.kind}
        </Badge>
      ))}
      <span className="sr-only">{t("patientbanner.mrn")}</span>
    </span>
  );
}

export function MoneyText({ fils, className, currency = true }: { fils: number | null | undefined; className?: string; currency?: boolean }) {
  const { t } = useI18n();
  if (fils == null) return <span className={cn("font-mono", className)}>—</span>;
  return (
    <span className={cn("font-mono tabular-nums", className)}>
      {BHD3(fils)}{currency ? ` ${t("money.currency")}` : ""}
    </span>
  );
}
