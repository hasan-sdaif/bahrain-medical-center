"use client";
/**
 * reception-queue — إدارة الطوابير: weighted queue per service point (§17.5).
 * Letter selector A–H → weighted table (server-sorted), big call-next w/ room,
 * serve/done/no-show actions, mini display monitor + realtime queue:called.
 */
import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/api-client";
import { useI18n, bi } from "@/i18n";
import { useToast } from "@/hooks/use-toast";
import { useRealtime } from "@/lib/realtime-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/badges";
import { ErrorBox, LoadingRows, SERVICE_POINTS, errText, type QueueRow } from "./emr-shared";
import { cn } from "@/lib/utils";

interface CalledInfo { id: string; code: string; room: string; priority: string; patient: { nameAr: string; mrn: string } | null }
interface DisplayRow { pointAr: string; pointEn: string; code: string; room: string; waitingCount: number }

const PRIO_TONE: Record<string, string> = {
  emergency: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200",
  elderly: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  disabled: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  pregnant: "bg-teal-100 text-teal-900 dark:bg-teal-950 dark:text-teal-200",
  child: "bg-teal-100 text-teal-900 dark:bg-teal-950 dark:text-teal-200",
};

export function ReceptionQueue() {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const [point, setPoint] = useState("C");
  const [room, setRoom] = useState("٣");
  const [rows, setRows] = useState<QueueRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [display, setDisplay] = useState<DisplayRow[]>([]);
  const [called, setCalled] = useState<CalledInfo | null>(null);
  const [calling, setCalling] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    apiGet<QueueRow[]>(`/api/staff/queue/list?point=${point}`)
      .then(setRows)
      .catch((e) => { setError(errText(e, lang)); setRows([]); });
    apiGet<{ display: DisplayRow[] }>("/api/queue/display")
      .then((r) => setDisplay(r.display))
      .catch(() => null);
  }, [point, lang]);

  useEffect(load, [load]);
  useRealtime("queue:called", () => load());

  const callNext = async () => {
    setCalling(true);
    try {
      const r = await apiPost<{ called: CalledInfo | null }>("/api/staff/queue/call-next", { point, room });
      setCalled(r.called);
      if (!r.called) toast({ title: t("rec.queue.none") });
      else toast({ title: t("rec.queue.callednow", { code: r.called.code }), description: `${r.called.room} · ${r.called.patient?.nameAr ?? ""}` });
      load();
    } catch (e) {
      toast({ title: t("common.error"), description: errText(e, lang), variant: "destructive" });
    } finally { setCalling(false); }
  };

  const serve = async (ticketId: string, code: string, action: "serve" | "done" | "no-show") => {
    setBusy(ticketId + action);
    try {
      await apiPost("/api/staff/queue/serve", { ticketId, action });
      toast({ title: t(`rec.queue.act.${action}`), description: code });
      if (called?.id === ticketId) setCalled(null);
      load();
    } catch (e) {
      toast({ title: t("common.error"), description: errText(e, lang), variant: "destructive" });
    } finally { setBusy(null); }
  };

  const waitingCount = (rows ?? []).filter((r) => r.status === "waiting").length;

  return (
    <div className="grid gap-3">
      {/* service point selector + room + call-next */}
      <div className="rounded-lg border p-3 grid gap-3">
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={t("rec.queue.point")}>
          <span className="text-xs text-muted-foreground me-1">{t("rec.queue.point")}:</span>
          {SERVICE_POINTS.map((sp) => (
            <button
              key={sp.letter}
              onClick={() => setPoint(sp.letter)}
              aria-pressed={point === sp.letter}
              className={cn(
                "h-9 px-2.5 rounded-lg border text-xs font-medium transition-colors",
                point === sp.letter ? "bg-primary text-primary-foreground border-transparent" : "hover:bg-muted",
              )}
              title={bi(lang, sp.ar, sp.en)}
            >
              <span className="font-mono font-bold me-1" aria-hidden>{sp.letter}</span>
              <span className="hidden sm:inline">{bi(lang, sp.ar, sp.en)}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="grid gap-1 w-32">
            <Label htmlFor="q-room" className="text-xs text-muted-foreground">{t("rec.queue.room")}</Label>
            <Input id="q-room" value={room} onChange={(e) => setRoom(e.target.value)} className="h-10 text-center font-bold" />
          </div>
          <Button size="lg" className="h-12 px-8 text-base font-bold" disabled={calling} onClick={callNext}>
            🔊 {calling ? t("common.loading") : t("rec.queue.callnext")}
          </Button>
          <Badge variant="outline" className="h-9 px-3 text-xs gap-1 self-end ms-auto">{t("rec.queue.waiting")}: <b className="font-mono">{waitingCount}</b></Badge>
        </div>
      </div>

      {/* called banner */}
      {called && (
        <div role="status" className="rounded-xl border-2 border-teal-600 bg-teal-50 dark:bg-teal-950/40 p-4 flex flex-wrap items-center gap-4">
          <div className="text-xs text-muted-foreground">{t("rec.queue.nowcalling")}</div>
          <div className="font-mono text-4xl font-black tracking-wider" dir="ltr">{called.code}</div>
          <div className="text-lg font-bold">{called.patient?.nameAr}</div>
          <div className="text-sm text-muted-foreground font-mono">{called.patient?.mrn}</div>
          <Badge className="bg-teal-600 border-transparent text-white text-sm">🚪 {called.room}</Badge>
          {called.priority !== "normal" && <Badge variant="outline" className={cn("border-transparent", PRIO_TONE[called.priority])}>{t(`priority.${called.priority}`)}</Badge>}
          <Button size="sm" className="ms-auto h-9" onClick={() => serve(called.id, called.code, "serve")}>{t("rec.queue.act.serve")}</Button>
        </div>
      )}

      {error && <ErrorBox message={error} onRetry={load} />}
      {!rows && !error && <LoadingRows n={5} />}

      {/* weighted queue table */}
      {rows && (
        <div className="rounded-lg border overflow-x-auto">
          <Table className="text-xs">
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="h-9 w-24">{t("rec.queue.col.ticket")}</TableHead>
                <TableHead className="h-9 min-w-40">{t("rec.queue.col.patient")}</TableHead>
                <TableHead className="h-9 w-24">{t("common.priority")}</TableHead>
                <TableHead className="h-9 w-24">{t("rec.queue.col.waited")}</TableHead>
                <TableHead className="h-9 w-20">{t("rec.queue.col.weight")}</TableHead>
                <TableHead className="h-9 w-24">{t("common.status")}</TableHead>
                <TableHead className="h-9 w-44 text-end">{t("common.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">{t("rec.queue.empty")}</TableCell></TableRow>}
              {rows.map((r) => (
                <TableRow key={r.id} className="[&>td]:py-1.5 [&>td]:px-2">
                  <TableCell className="font-mono font-bold text-sm" dir="ltr">{r.code}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-medium truncate max-w-44">{bi(lang, r.patient.nameAr, r.patient.nameEn)}</span>
                      <span className="font-mono text-muted-foreground">{r.patient.mrn}</span>
                    </div>
                  </TableCell>
                  <TableCell>{r.priority === "normal" ? <span className="text-muted-foreground">—</span> : <Badge variant="outline" className={cn("border-transparent", PRIO_TONE[r.priority] ?? "")}>{t(`priority.${r.priority}`)}</Badge>}</TableCell>
                  <TableCell className="font-mono tabular-nums">{t("rec.queue.min", { n: r.waitedMin })}</TableCell>
                  <TableCell><span className="font-mono font-bold" title={t("rec.queue.weighthint")}>{r.weight}</span></TableCell>
                  <TableCell><div className="flex items-center gap-1"><StatusBadge status={r.status} />{r.callCount > 0 && <span className="text-[10px] text-muted-foreground">×{r.callCount}</span>}</div></TableCell>
                  <TableCell className="text-end whitespace-nowrap">
                    <div className="inline-flex gap-1">
                      {r.status !== "serving" && <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" disabled={busy === r.id + "serve"} onClick={() => serve(r.id, r.code, "serve")}>{t("rec.queue.act.serve")}</Button>}
                      <Button size="sm" className="h-7 px-2 text-[11px] bg-emerald-600 hover:bg-emerald-700" disabled={busy === r.id + "done"} onClick={() => serve(r.id, r.code, "done")}>{t("rec.queue.act.done")}</Button>
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px] text-rose-600 hover:text-rose-700" disabled={busy === r.id + "no-show"} onClick={() => serve(r.id, r.code, "no-show")}>{t("rec.queue.act.no-show")}</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* mini display monitor */}
      <div className="rounded-lg border p-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-semibold">🖥️ {t("rec.queue.display")}</span>
          <Badge variant="outline" className="text-[10px] bg-teal-50">● {t("rec.queue.live")}</Badge>
          <Button size="sm" variant="ghost" className="ms-auto h-7 text-[11px]" onClick={load}>{t("common.refresh")}</Button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {display.map((d) => (
            <div key={d.pointAr} className={cn("rounded-lg border px-2.5 py-1.5 text-xs flex items-center gap-2", waitingCount > 0 && "bg-card")}>
              <span className="text-muted-foreground">{bi(lang, d.pointAr, d.pointEn)}</span>
              <span className="font-mono font-bold" dir="ltr">{d.code}</span>
              <span className="font-mono text-[10px] text-muted-foreground">{d.room}</span>
              <Badge variant="outline" className="h-5 px-1.5 text-[10px] gap-0.5">{t("rec.queue.waiting")}: {d.waitingCount}</Badge>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
