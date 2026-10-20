"use client";
/**
 * One "الآن / NOW" card for the TV display — point name, giant current ticket
 * (tabular-nums, 72px+), room label, waiting chip, flash on the latest call.
 * Readable from 3m: high contrast on zinc-950, no names (privacy).
 */
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import type { QueueRow } from "./use-queue-display";

export function DisplayCard({ row, flash }: { row: QueueRow; flash: string | null }) {
  const { t, lang } = useI18n();
  const active = row.code !== "—" && row.code !== "";
  const isFlash = active && flash === row.code;

  return (
    <article
      className={cn(
        "flex min-h-64 flex-col items-center justify-center gap-3 rounded-3xl border p-6 text-center transition-all duration-500 md:p-8",
        "border-zinc-800 bg-zinc-900",
        isFlash && "border-emerald-400 bg-emerald-950/40 ring-4 ring-emerald-400/50",
      )}
    >
      <h2 className="max-w-full truncate text-2xl font-bold text-zinc-300 md:text-3xl">
        {lang === "ar" ? row.pointAr : row.pointEn}
      </h2>
      <p className="text-sm font-bold uppercase tracking-[0.35em] text-emerald-400" aria-hidden>
        {t("queue.now")}
      </p>
      {active ? (
        <>
          <p
            dir="ltr"
            className={cn(
              "font-mono text-7xl font-black leading-none tabular-nums text-white md:text-8xl",
              isFlash && "animate-pulse text-emerald-300",
            )}
          >
            {row.code}
          </p>
          <p className="text-2xl font-bold text-zinc-100 md:text-3xl">
            {t("queue.room")} <span className="font-black text-emerald-300">{row.room}</span>
          </p>
        </>
      ) : (
        <p className="py-4 text-2xl font-semibold text-zinc-500 md:text-3xl">{t("queue.noCalls")}</p>
      )}
      <span className="mt-1 rounded-full bg-zinc-800 px-4 py-1.5 text-base font-semibold tabular-nums text-zinc-300">
        {t("queue.waiting", { n: row.waitingCount })}
      </span>
    </article>
  );
}
