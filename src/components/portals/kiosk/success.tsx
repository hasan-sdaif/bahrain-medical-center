"use client";
/**
 * Kiosk success — Shamel guide kiosk-confirm: white .entry-ticket "printed
 * ticket" (gradient head, giant .et-num queue number, et-meta grid, Code128
 * barcode in the dashed foot) on the teal-navy kiosk shell, 15s auto-reset.
 */
import { useEffect, useState } from "react";
import { BadgeCheck, ChevronsLeft, ChevronsRight, Users } from "lucide-react";
import { useI18n } from "@/i18n";
import { apiGet } from "@/lib/api-client";
import { Code128 } from "@/components/shared/barcode";
import { ShamelMark } from "@/components/shell/brand";
import type { KioskResult } from "./index";

const RESET_SECONDS = 15;

export default function CheckinSuccess({ result, onDone }: { result: KioskResult; onDone: () => void }) {
  const { t, dir } = useI18n();
  const [left, setLeft] = useState(RESET_SECONDS);
  const [waiting, setWaiting] = useState<number | null>(null);

  useEffect(() => {
    apiGet<{ display: { waitingCount: number }[] }>("/api/queue/display")
      .then((r) => setWaiting(r.display.reduce((sum, row) => sum + (row.waitingCount ?? 0), 0)))
      .catch(() => setWaiting(null));
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setLeft((s) => {
        if (s <= 1) { clearInterval(id); onDone(); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [onDone]);

  const Arrow = dir === "rtl" ? ChevronsLeft : ChevronsRight;

  return (
    <div className="grid w-full place-items-center gap-6 animate-in fade-in zoom-in-95">
      <article className="entry-ticket" aria-live="assertive">
        <header className="et-head flex items-center justify-center gap-3">
          <ShamelMark size={38} />
          <div className="text-start">
            <p className="font-[family-name:var(--font-cairo)] text-lg font-extrabold leading-tight">
              {t("kiosk.successTitle")}
            </p>
            <p className="text-sm text-white/80">{t("kiosk.ticketLabel")}</p>
          </div>
          <BadgeCheck className="size-8 text-teal-200" aria-hidden />
        </header>

        <div className="et-body">
          <p dir="ltr" className="et-num text-6xl md:text-7xl">{result.ticket.code}</p>

          <div className="et-meta">
            <div>
              <b>{t("kiosk.roomLabel")}</b>
              <span className="num text-2xl font-extrabold text-ink">{result.room}</span>
            </div>
            <div>
              <b>{t("kiosk.mrnLabel")}</b>
              <span dir="ltr" className="num text-2xl font-extrabold text-ink">{result.mrn}</span>
            </div>
            <div className="col-span-2">
              <b>{t("kiosk.goToRoom", { room: result.room })}</b>
              <span className="flex items-center gap-2 text-ink-2">
                <Arrow className="size-6 animate-pulse text-primary" aria-hidden />
                {waiting === null ? t("kiosk.receptionHelp") : t("kiosk.waitingCount", { n: waiting })}
                <Arrow className="size-6 animate-pulse text-primary" aria-hidden />
              </span>
            </div>
          </div>
        </div>

        <footer className="et-foot">
          <div dir="ltr" className="barcode lg">
            <Code128 value={result.ticket.code} height={72} className="text-zinc-900" />
          </div>
        </footer>
      </article>

      {/* auto-reset countdown (outside the printed ticket) */}
      <div className="w-full max-w-md text-white">
        <div className="progress p-thin p-teal bg-white/15" aria-hidden>
          <div className="p-fill" style={{ width: `${((RESET_SECONDS - left) / RESET_SECONDS) * 100}%` }} />
        </div>
        <div className="mt-3 flex items-center justify-center gap-4">
          <p className="text-sm text-white/75" aria-live="off">{t("kiosk.autoReset", { n: left })}</p>
          <button type="button" className="btn btn-white" onClick={onDone}>{t("kiosk.finish")}</button>
        </div>
        <p className="mt-3 flex items-center justify-center gap-2 text-xs text-white/60">
          <Users className="size-4" aria-hidden /> {t("kiosk.footLeave")}
        </p>
      </div>
    </div>
  );
}
