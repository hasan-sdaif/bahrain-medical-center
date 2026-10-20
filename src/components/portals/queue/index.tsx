"use client";
/**
 * queue.website.bh — Shamel guide waiting-room TV screen: full-bleed navy-950
 * .queue-screen, brand header + live BH clock, giant .qs-now hero (latest
 * called ticket, flash-target first) + side .qs-list per service point.
 * Realtime: hook untouched (poll + socket.io io("/?XTransformPort=3003")).
 * Privacy: ticket codes + rooms only — never patient names.
 */
import { useEffect, useState } from "react";
import { Activity, ListOrdered, Phone, Volume2, VolumeX } from "lucide-react";
import { useI18n } from "@/i18n";
import { bhTime, bhTimeString } from "@/lib/bahrain";
import { ShamelAccent, ShamelMark } from "@/components/shell/brand";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useQueueDisplay } from "./use-queue-display";
import { NowHero, PointRow } from "./display-card";

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

  const active = (rows ?? []).filter((r) => r.code !== "—" && r.code !== "");
  const hero = flash ? (rows ?? []).find((r) => r.code === flash) : undefined;
  const heroRow = hero ?? active[active.length - 1] ?? null;
  const totalWaiting = (rows ?? []).reduce((sum, r) => sum + (r.waitingCount ?? 0), 0);

  return (
    <div className="queue-screen flex min-h-[calc(100dvh-10.5rem)] flex-col rounded-none">
      <ShamelAccent />

      <header className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-white/10 px-5 py-4 md:px-8">
        <ShamelMark size={46} />
        <div className="min-w-0">
          <p className="font-[family-name:var(--font-cairo)] text-xl font-extrabold leading-tight text-white md:text-2xl">
            {t("shell.app.name")}
          </p>
          <p className="text-sm text-white/60">{t("queue.title")} · <span dir="ltr" className="num">queue.website.bh</span></p>
        </div>

        <span
          className={cn(
            "inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-bold",
            connected ? "bg-teal-400/15 text-teal-300" : "bg-white/10 text-white/50",
          )}
        >
          <Activity className={cn("size-4", connected && "animate-pulse")} aria-hidden />
          {t("queue.live")}
        </span>
        <button
          type="button"
          onClick={toggleMute}
          aria-pressed={muted}
          aria-label={muted ? t("queue.soundOff") : t("queue.soundOn")}
          className="inline-flex h-11 min-w-11 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3.5 text-sm font-bold text-white transition hover:bg-white/20"
        >
          {muted ? <VolumeX className="size-5" aria-hidden /> : <Volume2 className="size-5" aria-hidden />}
          <span className="hidden sm:inline">{muted ? t("queue.soundOff") : t("queue.soundOn")}</span>
        </button>

        <div className="ms-auto text-end">
          <p dir="ltr" className="num text-4xl font-extrabold leading-none text-white md:text-5xl">{bhTimeString(now)}</p>
          <p className="mt-1 text-xs text-white/60 md:text-sm">{dateLabel} · UTC+3</p>
        </div>
      </header>

      {error && (
        <p
          role="alert"
          className="mx-5 mt-3 rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-2.5 text-base font-semibold text-amber-200 md:mx-8"
        >
          {t("queue.error")}{" "}
          <button type="button" onClick={retry} className="font-bold underline underline-offset-4">
            {t("common.retry")}
          </button>
        </p>
      )}

      <main
        aria-label={t("queue.now")}
        className="grid flex-1 content-center gap-5 px-5 py-5 md:px-8 lg:grid-cols-[minmax(0,1fr)_340px]"
      >
        {/* giant now-serving hero */}
        {rows === null ? (
          <div className="grid place-items-center">
            <Skeleton className="h-64 w-full max-w-xl rounded-3xl bg-white/10" />
          </div>
        ) : (
          <NowHero row={heroRow} flash={flash} />
        )}

        {/* per-point current tickets */}
        <aside
          aria-label={t("queue.nextUp")}
          className="flex flex-col rounded-2xl border border-white/10 bg-white/[.04] p-4"
        >
          <h2 className="flex items-center gap-2 text-base font-bold text-teal-300 md:text-lg">
            <ListOrdered className="size-5" aria-hidden />
            {t("queue.nextUp")}
          </h2>
          <div className="mt-3 grid max-h-96 gap-2.5 overflow-y-auto">
            {rows === null
              ? Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-16 rounded-xl bg-white/10" />)
              : rows.map((row) => <PointRow key={`${row.pointAr}|${row.pointEn}`} row={row} flash={flash} />)}
            {rows !== null && rows.length === 0 && (
              <p className="py-8 text-center text-lg text-white/50">{t("queue.connecting")}</p>
            )}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2.5 border-t border-white/10 pt-4">
            <div className="rounded-xl bg-white/[.06] p-3 text-center">
              <div className="num text-2xl font-extrabold text-white">{totalWaiting}</div>
              <div className="text-xs text-white/60">{t("queue.totalWaiting")}</div>
            </div>
            <div className="rounded-xl bg-white/[.06] p-3 text-center">
              <div className="num text-2xl font-extrabold text-white">{rows?.length ?? "—"}</div>
              <div className="text-xs text-white/60">{t("queue.pointsCount")}</div>
            </div>
          </div>
        </aside>
      </main>

      <footer className="flex flex-wrap items-center gap-x-6 gap-y-1 border-t border-white/10 px-5 py-3 text-xs text-white/50 md:px-8 md:text-sm">
        <span>© {new Date().getFullYear()} {t("shell.app.name")}</span>
        <span>{t("queue.privacy")}</span>
        <span dir="ltr" className="num ms-auto inline-flex items-center gap-1.5">
          <Phone className="size-3.5" aria-hidden /> +973 1750 0000
        </span>
      </footer>
    </div>
  );
}
