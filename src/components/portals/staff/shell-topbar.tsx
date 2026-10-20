"use client";
/**
 * shell-topbar.tsx — Shamel topbar (doctor/dashboard.html): burger (≤1180px
 * off-canvas) + collapse toggle (desktop, persisted), quick-search with a real
 * ⌘K/Ctrl+K focus shortcut, staff.website.bh subdomain chip, live Bahrain
 * (UTC+3) clock ticking every second, notifications popover fed by the inbox
 * poll, and compact language/theme toggles.
 */
import { useEffect, useRef, useState } from "react";
import {
  Bell, CalendarDays, ClipboardList, Menu, Package, PanelRightClose, PanelRightOpen, Phone, Search, ShieldCheck, TriangleAlert,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useI18n } from "@/i18n";
import { bhDateString } from "@/lib/bahrain";
import { LangThemeButtons } from "./shell-identity";
import { cn } from "@/lib/utils";

export interface InboxTask {
  id: string;
  titleAr: string;
  priority: string;
  dueAt: string | null;
  kind: string | null;
  patient: { mrn: string; nameAr: string } | null;
}

const TASK_ICON: Record<string, { icon: LucideIcon; ic: string }> = {
  "critical-result": { icon: TriangleAlert, ic: "ic-red" },
  callback: { icon: Phone, ic: "ic-teal" },
  preauth: { icon: ShieldCheck, ic: "ic-navy" },
  "part-issue": { icon: Package, ic: "ic-amber" },
};

function priorityBadge(p: string): string {
  return p === "urgent" || p === "high" ? "b-red" : p === "normal" ? "b-amber" : "b-teal";
}
function priorityLabelKey(p: string): string {
  return p === "urgent" ? "priority.urgent" : p === "high" ? "priority.high" : p === "normal" ? "flag.normal" : "priority.routine";
}

/** Live Bahrain clock (UTC+3) — updates every second, latin digits (.num). */
function ClockChip() {
  const { lang } = useI18n();
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1_000);
    return () => clearInterval(id);
  }, []);
  const loc = `${lang === "ar" ? "ar-BH" : "en-GB"}-u-nu-latn`;
  const date = now
    ? new Intl.DateTimeFormat(loc, { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Bahrain" }).format(now)
    : "";
  const time = now
    ? new Intl.DateTimeFormat(loc, { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "Asia/Bahrain" }).format(now)
    : "--:--:--";
  return (
    <span className="clock-chip" suppressHydrationWarning>
      <CalendarDays className="size-3.5 opacity-70" aria-hidden />
      <span>{date}</span>
      <span aria-hidden className="opacity-40">·</span>
      <span className="num font-semibold">{time}</span>
    </span>
  );
}

function NotifMenu({ inbox, inboxCount }: { inbox: InboxTask[]; inboxCount: number }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);
  return (
    <div className={cn("dropdown", open && "open")} ref={ref}>
      <button
        type="button"
        className="btn btn-ghost btn-icon relative"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("staff.shell.notifs")}
        onClick={() => setOpen((v) => !v)}
      >
        <Bell className="size-5" aria-hidden />
        {inboxCount > 0 && (
          <span className="nav-badge absolute top-1.5 end-1.5 min-w-[18px] px-[5px] py-px text-[10px]">{inboxCount}</span>
        )}
      </button>
      <div className="drop-menu w-wide" role="menu" aria-label={t("staff.shell.notifs")}>
        <div className="drop-header flex items-center justify-between">
          <span>{t("staff.shell.inbox")}</span>
          {inboxCount > 0 && <span className="badge sm b-teal">{inboxCount}</span>}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {inbox.length === 0 ? (
            <p className="px-3 py-6 text-center text-[length:var(--fs-sm)] text-ink-3">{t("staff.shell.notifsEmpty")}</p>
          ) : (
            inbox.map((task) => {
              const meta = TASK_ICON[task.kind ?? ""] ?? { icon: ClipboardList, ic: "ic-teal" };
              const Icon = meta.icon;
              const due = task.dueAt ? t("staff.shell.notifDue", { date: bhDateString(task.dueAt) }) : "";
              return (
                <div key={task.id} className="notif-item" role="menuitem">
                  <span className={cn("ni-ic", meta.ic)}>
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <span className="ni-body">
                    <span className="ni-title">{task.titleAr}</span>
                    <span className="ni-sub">
                      {task.patient ? `${task.patient.nameAr} · ` : ""}
                      <span className="mono text-[10px]">{task.patient?.mrn}</span>
                    </span>
                  </span>
                  <span className="flex flex-col items-end gap-1.5">
                    <span className={cn("badge sm", priorityBadge(task.priority))}>{t(priorityLabelKey(task.priority))}</span>
                    {due && <span className="ni-time num">{due}</span>}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

export interface StaffTopbarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  onOpenSide: () => void;
  inbox: InboxTask[];
  inboxCount: number;
}

export function StaffTopbar({ collapsed, onToggleCollapse, onOpenSide, inbox, inboxCount }: StaffTopbarProps) {
  const { t } = useI18n();
  const searchRef = useRef<HTMLInputElement>(null);
  const [isMac, setIsMac] = useState(false);
  useEffect(() => {
    setIsMac(/mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent));
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className="topbar top-14 no-print">
      <button
        type="button"
        className="btn btn-ghost btn-icon min-[1181px]:hidden"
        aria-label={t("staff.shell.menu")}
        onClick={onOpenSide}
      >
        <Menu className="size-5" aria-hidden />
      </button>
      <button
        type="button"
        className="btn btn-ghost btn-icon side-collapse-btn"
        aria-label={collapsed ? t("staff.shell.expand") : t("staff.shell.collapse")}
        title={collapsed ? t("staff.shell.expand") : t("staff.shell.collapse")}
        onClick={onToggleCollapse}
      >
        {collapsed ? <PanelRightOpen className="size-5" aria-hidden /> : <PanelRightClose className="size-5" aria-hidden />}
      </button>

      <div className="topbar-search" role="search">
        <Search className="search-icon size-4" aria-hidden />
        <input
          ref={searchRef}
          type="search"
          placeholder={t("staff.shell.searchPh")}
          aria-label={t("staff.shell.searchLabel")}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } }}
        />
        <span className="kbd-hint" aria-hidden><kbd>{isMac ? "⌘ K" : "Ctrl K"}</kbd></span>
      </div>

      <div className="topbar-actions">
        <span className="subdomain-chip"><span className="dot" aria-hidden />staff.website.bh</span>
        <ClockChip />
        <NotifMenu inbox={inbox} inboxCount={inboxCount} />
        <span className="topbar-divider" aria-hidden />
        <LangThemeButtons />
      </div>
    </header>
  );
}
