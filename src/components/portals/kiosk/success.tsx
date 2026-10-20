"use client";
/**
 * Kiosk success — full-screen celebration: big ticket code + Code128 barcode,
 * room label, waiting count, "proceed to room" animation, 15s auto-reset.
 */
import { useEffect, useState } from "react";
import { BadgeCheck, ChevronsLeft, ChevronsRight, Users } from "lucide-react";
import { useI18n } from "@/i18n";
import { apiGet } from "@/lib/api-client";
import { Code128 } from "@/components/shared/barcode";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
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
    <section
      aria-live="assertive"
      className="flex-1 grid place-items-center px-6 md:px-10 py-8 animate-in fade-in zoom-in-95"
    >
      <div className="w-full max-w-3xl rounded-[2rem] border-2 border-emerald-400/60 bg-card p-8 md:p-12 shadow-2xl text-center">
        <BadgeCheck className="mx-auto size-20 text-emerald-500 animate-in zoom-in-50" aria-hidden />
        <h2 className="mt-4 text-3xl md:text-5xl font-black text-emerald-600 dark:text-emerald-400">
          {t("kiosk.successTitle")}
        </h2>

        {/* ticket code — huge, scannable */}
        <p className="mt-6 text-lg md:text-xl font-semibold text-muted-foreground">{t("kiosk.ticketLabel")}</p>
        <p dir="ltr" className="font-mono text-7xl md:text-9xl font-black tabular-nums tracking-tight leading-none my-2">
          {result.ticket.code}
        </p>
        <div className="mx-auto max-w-md rounded-2xl bg-white p-3 border shadow-inner">
          <Code128 value={result.ticket.code} height={64} className="mx-auto text-zinc-900" />
        </div>

        {/* proceed to room — animated */}
        <div className="mt-8 flex items-center justify-center gap-3 text-primary">
          <Arrow className="size-10 animate-ping opacity-60" aria-hidden />
          <Arrow className="size-10 animate-pulse" aria-hidden />
          <p className="text-2xl md:text-4xl font-black animate-pulse">
            {t("kiosk.goToRoom", { room: result.room })}
          </p>
          <Arrow className="size-10 animate-pulse" aria-hidden />
          <Arrow className="size-10 animate-ping opacity-60" aria-hidden />
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-3xl border bg-background p-5">
            <p className="text-base font-semibold text-muted-foreground">{t("kiosk.roomLabel")}</p>
            <p className="text-5xl md:text-6xl font-black mt-1">{result.room}</p>
          </div>
          <div className="rounded-3xl border bg-background p-5 grid place-items-center">
            {waiting === null ? (
              <p className="text-lg text-muted-foreground">{t("kiosk.receptionHelp")}</p>
            ) : (
              <p className="flex items-center gap-3 text-2xl md:text-3xl font-bold">
                <Users className="size-8 text-primary" aria-hidden />
                {t("kiosk.waitingCount", { n: waiting })}
              </p>
            )}
          </div>
        </div>

        {/* auto-reset countdown */}
        <div className="mt-8">
          <Progress value={((RESET_SECONDS - left) / RESET_SECONDS) * 100} className="h-3" aria-hidden />
          <div className="mt-3 flex items-center justify-center gap-4">
            <p className={cn("text-sm md:text-base text-muted-foreground tabular-nums")} aria-live="off">
              {t("kiosk.autoReset", { n: left })}
            </p>
            <Button size="lg" className="h-12 px-6 text-base font-bold rounded-xl" onClick={onDone}>
              {t("kiosk.finish")}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
