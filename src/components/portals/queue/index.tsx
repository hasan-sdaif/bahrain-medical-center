"use client";
/**
 * queue.website.bh — شاشة الانتظار (TV waiting-room display).
 * Dark zinc-950 canvas, huge "NOW" grid (one card per service point),
 * BH clock header, 10s polling + realtime flash/chime, landscape & portrait.
 * Privacy: ticket codes + rooms only — never patient names.
 */
import { useEffect, useState } from "react";
import { Activity, Building2, Volume2, VolumeX } from "lucide-react";
import { useI18n } from "@/i18n";
import { bhTime, bhTimeString } from "@/lib/bahrain";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useQueueDisplay } from "./use-queue-display";
import { DisplayCard } from "./display-card";

export default function QueuePortal() {
  const { t, lang } = useI18n();
  const { rows, error, flash, muted, connected, toggleMute, retry } = useQueueDisplay();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const dateLabel = bhTime(now).toLocaleDateString(
    lang === "ar" ? "ar-BH" : "en-GB",
    { weekday: "long", day: "numeric", month: "long", year: "numeric" },
  );

  return (
    <div className="flex min-h-[calc(100dvh-10.5rem)] flex-col bg-zinc-950 text-zinc-50">
      <header className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-zinc-800 px-6 py-5 md:px-10">
        <div className="flex items-center gap-3">
          <div className="grid size-12 place-items-center rounded-xl bg-emerald-500/15 text-emerald-400">
            <Building2 className="size-6" aria-hidden />
          </div>
          <div>
            <p className="text-xl font-bold md:text-2xl">{t("shell.app.name")}</p>
            <p className="hidden text-sm text-zinc-400 sm:block">{t("queue.privacy")}</p>
          </div>
        </div>

        <div className="mx-auto text-center" dir="ltr">
          <p className="text-5xl font-black leading-none tracking-tight text-emerald-400 tabular-nums md:text-6xl">
            {bhTimeString(now)}
          </p>
          <p className="mt-1 text-sm text-zinc-400 md:text-base">{dateLabel}</p>
        </div>

        <div className="flex items-center gap-3 ms-auto">
          <span
            className={cn(
              "flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-bold",
              connected ? "bg-emerald-500/15 text-emerald-400" : "bg-zinc-800 text-zinc-400",
            )}
          >
            <Activity className={cn("size-4", connected && "animate-pulse")} aria-hidden />
            {t("queue.live")}
          </span>
          <Button
            variant="outline"
            className="h-12 gap-2 rounded-xl border-zinc-700 bg-zinc-900 text-zinc-50 hover:bg-zinc-800 hover:text-zinc-50"
            onClick={toggleMute}
            aria-pressed={muted}
            aria-label={muted ? t("queue.soundOff") : t("queue.soundOn")}
          >
            {muted ? <VolumeX className="size-5" aria-hidden /> : <Volume2 className="size-5" aria-hidden />}
            <span className="hidden sm:inline">{muted ? t("queue.soundOff") : t("queue.soundOn")}</span>
          </Button>
        </div>
      </header>

      {error && (
        <p
          role="alert"
          className="mx-6 mt-4 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-5 py-3 text-lg font-semibold text-amber-300 md:mx-10"
        >
          {t("queue.error")}{" "}
          <button type="button" onClick={retry} className="font-bold underline underline-offset-4">
            {t("common.retry")}
          </button>
        </p>
      )}

      <main
        aria-label={t("queue.now")}
        className="auto-rows-fr content-center grid flex-1 grid-cols-1 gap-4 px-6 py-6 sm:grid-cols-2 md:gap-6 md:px-10 xl:grid-cols-3"
      >
        {rows === null ? (
          Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="min-h-64 rounded-3xl bg-zinc-900" />
          ))
        ) : (
          rows.map((row) => (
            <DisplayCard key={`${row.pointAr}|${row.pointEn}`} row={row} flash={flash} />
          ))
        )}
        {rows !== null && rows.length === 0 && (
          <p className="col-span-full py-16 text-center text-2xl text-zinc-400">{t("queue.connecting")}</p>
        )}
      </main>

      <footer className="flex flex-wrap gap-x-6 gap-y-1 border-t border-zinc-800 px-6 py-3 text-sm text-zinc-500 md:px-10">
        <span>© {new Date().getFullYear()} {t("shell.app.name")}</span>
        <span>{t("queue.privacy")}</span>
        <span dir="ltr" className="font-mono ms-auto">+973 1750 0000</span>
      </footer>
    </div>
  );
}
