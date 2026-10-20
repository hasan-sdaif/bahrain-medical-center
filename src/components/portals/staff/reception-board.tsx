"use client";
/**
 * reception-board — لوحة اليوم: today's appointments, statuses, check-in actions.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "@/lib/api-client";
import { useI18n } from "@/i18n";
import { useToast } from "@/hooks/use-toast";
import { bhTimeString } from "@/lib/bahrain";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/badges";
import { AssuranceDot, DEPARTMENTS, ErrorBox, LoadingRows, PrintStyle, setLastPatient, type BoardRow, type CheckinResp } from "./emr-shared";
import { cn } from "@/lib/utils";

const PAY_TONES: Record<string, string> = {
  paid: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  insured: "bg-teal-100 text-teal-900 dark:bg-teal-950 dark:text-teal-200",
  unpaid: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

export function ReceptionBoard() {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const [rows, setRows] = useState<BoardRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dept, setDept] = useState("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [localConfirmed, setLocalConfirmed] = useState<Set<string>>(new Set());

  const load = useCallback(() => {
    setError(null);
    apiGet<BoardRow[]>(`/api/staff/board${dept === "all" ? "" : `?dept=${dept}`}`)
      .then(setRows)
      .catch((e) => { setError(String((e as { problem?: { detailAr?: string } }).problem?.detailAr ?? e.message)); setRows([]); });
  }, [dept]);

  useEffect(load, [load]);

  const filtered = useMemo(() => rows ?? [], [rows]);
  const stats = useMemo(() => ({
    total: filtered.length,
    waiting: filtered.filter((r) => ["requested", "confirmed"].includes(r.status)).length,
    arrived: filtered.filter((r) => r.status === "arrived").length,
    done: filtered.filter((r) => ["completed", "in-service"].includes(r.status)).length,
  }), [filtered]);

  const checkin = async (row: BoardRow) => {
    setBusy(row.id);
    try {
      const r = await apiPost<CheckinResp>("/api/staff/checkin", { appointmentId: row.id });
      toast({ title: t("rec.checkin.ok", { name: row.patient.nameAr }), description: t("rec.checkin.ticket", { code: r.ticket.code }) });
      setLastPatient({ id: row.patient.id, mrn: row.patient.mrn, nameAr: row.patient.nameAr });
      load();
    } catch (e) {
      toast({ title: t("common.error"), description: String((e as { problem?: { detailAr?: string }; message?: string }).problem?.detailAr ?? (e as Error).message), variant: "destructive" });
    } finally { setBusy(null); }
  };

  const confirmLocal = (row: BoardRow) => {
    setLocalConfirmed((s) => new Set(s).add(row.id));
    toast({ title: t("rec.confirm.ok", { code: row.code }) });
  };

  const openFile = (row: BoardRow) => {
    setLastPatient({ id: row.patient.id, mrn: row.patient.mrn, nameAr: row.patient.nameAr });
    toast({ title: t("rec.openfile.ok", { name: row.patient.nameAr }), description: t("rec.openfile.hint") });
  };

  return (
    <div className="grid gap-3">
      <PrintStyle />
      <div className="flex flex-wrap items-center gap-2">
        <Select value={dept} onValueChange={setDept}>
          <SelectTrigger className="w-44 h-9 text-xs" aria-label={t("common.filter")}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">{t("common.all")}</SelectItem>
            {DEPARTMENTS.map((d) => <SelectItem key={d.code} value={d.code} className="text-xs">{lang === "ar" ? d.ar : d.en}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex gap-1.5 text-xs ms-auto">
          <Badge variant="outline" className="gap-1">{t("rec.stat.total")}: <b>{stats.total}</b></Badge>
          <Badge variant="outline" className="gap-1 bg-amber-50">{t("rec.stat.waiting")}: <b>{stats.waiting}</b></Badge>
          <Badge variant="outline" className="gap-1 bg-teal-50">{t("rec.stat.arrived")}: <b>{stats.arrived}</b></Badge>
          <Badge variant="outline" className="gap-1 bg-emerald-50">{t("rec.stat.done")}: <b>{stats.done}</b></Badge>
        </div>
        <Button size="sm" variant="outline" className="h-8" onClick={load}>{t("common.refresh")}</Button>
      </div>

      {error && <ErrorBox message={error} onRetry={load} />}
      {!rows && !error && <LoadingRows n={6} />}

      {rows && (
        <div className="rounded-lg border overflow-x-auto">
          <Table className="text-xs">
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="h-9 w-16">{t("common.time")}</TableHead>
                <TableHead className="h-9 min-w-44">{t("rec.col.patient")}</TableHead>
                <TableHead className="h-9 min-w-24">{t("common.type")}</TableHead>
                <TableHead className="h-9 min-w-28">{t("rec.col.doctor")}</TableHead>
                <TableHead className="h-9 w-20">{t("rec.col.channel")}</TableHead>
                <TableHead className="h-9 w-20">{t("rec.col.pay")}</TableHead>
                <TableHead className="h-9 w-24">{t("common.status")}</TableHead>
                <TableHead className="h-9 w-44 text-end">{t("common.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">{t("common.empty")}</TableCell></TableRow>
              )}
              {filtered.map((r) => {
                const late = new Date(r.start).getTime() < Date.now() && ["requested", "confirmed"].includes(r.status);
                const status = localConfirmed.has(r.id) && r.status === "requested" ? "confirmed" : r.status;
                return (
                  <TableRow key={r.id} className={cn("[&>td]:py-1.5 [&>td]:px-2", late && "bg-amber-50/60 dark:bg-amber-950/20")}>
                    <TableCell className="font-mono tabular-nums whitespace-nowrap">{bhTimeString(r.start)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <AssuranceDot level={r.patient.assurance} />
                        <span className="font-medium truncate max-w-40">{lang === "ar" ? r.patient.nameAr : r.patient.nameEn ?? r.patient.nameAr}</span>
                        <span className="font-mono text-muted-foreground">{r.patient.mrn}</span>
                      </div>
                    </TableCell>
                    <TableCell className="truncate max-w-32">{lang === "ar" ? r.type.nameAr : r.type.nameEn}</TableCell>
                    <TableCell className="truncate max-w-32">{r.doctor ? (lang === "ar" ? r.doctor.nameAr : r.doctor.nameEn) : "—"}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px] font-mono">{t(`rec.channel.${r.channel}`)}</Badge></TableCell>
                    <TableCell><Badge variant="outline" className={cn("text-[10px] border-transparent", PAY_TONES[r.paymentStatus] ?? PAY_TONES.unpaid)}>{t(`rec.pay.${r.paymentStatus}`)}</Badge></TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 flex-wrap">
                        <StatusBadge status={status} />
                        {late && <Badge variant="outline" className="text-[10px] border-transparent bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200">{t("rec.late")}</Badge>}
                        {localConfirmed.has(r.id) && <span className="text-[9px] text-muted-foreground">{t("rec.local")}</span>}
                      </div>
                    </TableCell>
                    <TableCell className="text-end whitespace-nowrap">
                      <div className="inline-flex gap-1">
                        {r.status === "requested" && !localConfirmed.has(r.id) && (
                          <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={() => confirmLocal(r)}>{t("rec.action.confirm")}</Button>
                        )}
                        {["requested", "confirmed"].includes(r.status) && (
                          <Button size="sm" className="h-7 px-2 text-[11px]" disabled={busy === r.id} onClick={() => checkin(r)}>{busy === r.id ? "…" : t("rec.action.arrive")}</Button>
                        )}
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]" onClick={() => openFile(r)}>{t("rec.action.open")}</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
