"use client";
/**
 * Queue display pieces (Shamel guide 07-medical.css):
 * - NowHero: giant .qs-now card — "يدخل الآن" label, huge .qs-num ticket,
 *   room + department, CSS entrance animation replayed on ticket change.
 * - PointRow: .qs-item list row per service point (code, point, room, waiting).
 * Readable from 3m: high contrast on navy-950, no names (privacy).
 */
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import type { QueueRow } from "./use-queue-display";

export function NowHero({ row, flash }: { row: QueueRow | null; flash: string | null }) {
  const { t, lang } = useI18n();
  const active = !!row && row.code !== "—" && row.code !== "";
  const isFlash = active && flash === row!.code;

  return (
    <section
      aria-label={t("queue.now")}
      className={cn(
        "qs-now grid content-center justify-items-center rounded-2xl border p-6 text-center transition-all duration-500 md:p-10",
        isFlash
          ? "border-teal-300/70 bg-teal-400/10 ring-4 ring-teal-300/30"
          : "border-white/10 bg-white/[.04]",
      )}
    >
      <p className="qs-lbl flex items-center gap-3">
        {active && <span className="inline-block size-2.5 animate-pulse rounded-full bg-teal-300" aria-hidden />}
        {t("queue.entering")}
      </p>
      {active ? (
        <>
          <p
            key={row!.code}
            dir="ltr"
            className={cn(
              "qs-num animate-in fade-in zoom-in-95 duration-500",
              isFlash && "animate-pulse",
            )}
          >
            {row!.code}
          </p>
          <p className="mt-3 text-xl font-bold text-teal-300 md:text-2xl">
            {lang === "ar" ? row!.pointAr : row!.pointEn}
          </p>
          <p className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-lg text-white/80 md:text-xl">
            <span>
              {t("queue.room")} <b className="num text-2xl font-extrabold text-white">{row!.room}</b>
            </span>
            <span className="rounded-full bg-white/10 px-4 py-1 text-sm md:text-base">
              {t("queue.waiting", { n: row!.waitingCount })}
            </span>
          </p>
        </>
      ) : (
        <p className="qs-num text-5xl text-white/40 md:text-6xl">{t("queue.noCalls")}</p>
      )}
    </section>
  );
}

export function PointRow({ row, flash }: { row: QueueRow; flash: string | null }) {
  const { t, lang } = useI18n();
  const active = row.code !== "—" && row.code !== "";
  const isFlash = active && flash === row.code;

  return (
    <div
      className={cn(
        "qs-item flex items-center gap-3 rounded-xl p-3.5 text-start transition-all duration-300",
        isFlash && "border-teal-300/70 bg-teal-400/10",
      )}
    >
      <div className="min-w-0 flex-1">
        <p
          key={row.code}
          dir="ltr"
          className={cn("qsi-num animate-in fade-in slide-in-from-bottom-2 duration-300", !active && "text-white/35")}
        >
          {row.code}
        </p>
        <p className="qsi-room truncate">
          {lang === "ar" ? row.pointAr : row.pointEn}
          {active && <> · {t("queue.room")} <span className="num">{row.room}</span></>}
        </p>
      </div>
      <span className="badge shrink-0 rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white/80">
        <span className="num">{row.waitingCount}</span>
      </span>
    </div>
  );
}
