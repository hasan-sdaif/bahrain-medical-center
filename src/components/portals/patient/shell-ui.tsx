"use client";
/**
 * Patient portal — Shamel UI guide primitives shared by all screens:
 * PageHead (`.page-head` + `.page-title-ic`), StatCard (`.stat-card` KPI),
 * StBadge (`.badge .st-*`/`.b-*` statuses), FlagBadge (`.flag` lab flags).
 * (Guide: 03-layout §page-head, 05-cards-tables §stat/badge, 07-medical §flag)
 */
import type { ReactNode } from "react";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

/** Status → Shamel badge tone (appointments, payments, rx, home-draw flow). */
const ST: Record<string, string> = {
  // appointments / visits
  requested: "b-amber", confirmed: "st-confirmed", arrived: "st-checkedin",
  "in-service": "st-progress", completed: "st-completed", cancelled: "st-cancelled",
  "no-show": "st-nohow", rescheduled: "b-amber",
  // lab flags
  normal: "b-green", H: "b-amber", L: "b-amber", CRIT: "b-red",
  // payments / invoices
  paid: "b-green", partial: "b-amber", issued: "b-sky", unpaid: "b-red", captured: "b-green",
  // documents / consents / prescriptions
  signed: "b-teal", active: "b-green", withdrawn: "b-slate", expired: "b-slate",
  // home draw flow
  assigned: "b-sky", "on-the-way": "st-progress", drawn: "b-violet", "to-lab": "b-cyan", delivered: "st-completed",
};

/** Shamel status badge — replaces the shared StatusBadge inside the portal. */
export function StBadge({ status, className }: { status: string; className?: string }) {
  const { t } = useI18n();
  return (
    <span className={cn("badge", ST[status] ?? "b-slate", className)}>
      <span className="dot" aria-hidden />
      {t(`status.${status}`)}
    </span>
  );
}

/** Lab flag square (H/L/N/!) — guide 07-medical `.flag`. */
export function FlagBadge({ flag }: { flag: string }) {
  const { t } = useI18n();
  const tone = flag === "CRIT" ? "crit" : flag === "H" ? "h" : flag === "L" ? "l" : "n";
  const glyph = flag === "CRIT" ? "!" : flag === "normal" ? "N" : flag;
  return <span className={cn("flag", tone)} role="img" aria-label={t(`flag.${flag}`)}>{glyph}</span>;
}

/** Screen header — guide `.page-head` with icon tile, h1, sub and actions. */
export function PageHead({
  icon: Icon, title, sub, actions,
}: { icon: LucideIcon; title: string; sub?: string; actions?: ReactNode }) {
  return (
    <div className="page-head">
      <div className="page-head-row">
        <div className="page-title-wrap">
          <span className="page-title-ic" aria-hidden>
            <Icon className="size-7" />
          </span>
          <div className="min-w-0">
            <h1>{title}</h1>
            {sub ? <p className="page-sub">{sub}</p> : null}
          </div>
        </div>
        {actions ? <div className="page-head-actions">{actions}</div> : null}
      </div>
    </div>
  );
}

/** KPI tile — guide `.card.stat-card` (sc-top/sc-ic/sc-value/sc-foot + delta). */
export function StatCard({
  label, value, icon: Icon, tone = "ic-teal", delta, deltaTone = "flat", sub, onClick, ariaLabel,
}: {
  label: string; value: ReactNode; icon: LucideIcon; tone?: string;
  delta?: string; deltaTone?: "up" | "down" | "flat"; sub?: string;
  onClick?: () => void; ariaLabel?: string;
}) {
  const inner = (
    <>
      <div className="sc-top">
        <span className="sc-label">{label}</span>
        <span className={cn("sc-ic", tone)} aria-hidden><Icon className="size-5" /></span>
      </div>
      <div className="sc-value">{value}</div>
      {(delta || sub) && (
        <div className="sc-foot">
          {delta ? <span className={cn("delta", deltaTone)}>{delta}</span> : null}
          {sub ? <span className="sc-sub">{sub}</span> : null}
        </div>
      )}
    </>
  );
  if (onClick) {
    return (
      <button type="button" onClick={onClick} aria-label={ariaLabel ?? label}
        className="card stat-card interactive text-start">
        {inner}
      </button>
    );
  }
  return <div className="card stat-card">{inner}</div>;
}

/** Neutral datetime chip used on rows (mono, ltr) — `.badge b-slate`. */
export function TimeChip({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("badge b-slate", className)} dir="ltr">{children}</span>;
}
