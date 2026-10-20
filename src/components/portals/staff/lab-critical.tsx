"use client";
/**
 * التنبيهات الحرجة — unacknowledged critical values with live minute counters,
 * escalation log timeline, read-and-understood acknowledgement, and the
 * scheduler-driven escalation chain explainer (10 min → on-call → 20 min → heads).
 */
import { useEffect, useState } from "react";
import { useI18n } from "@/i18n";
import { apiPost } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { FlagBadge, LabPanel, errText, useLab, type CriticalAlertRow, type LabWorklist } from "./lab-shared";

const ST_TONE: Record<string, string> = {
  new: "bg-red-600 text-white",
  "escalated-1": "bg-red-600 text-white animate-pulse",
  "escalated-2": "bg-red-800 text-white animate-pulse",
  acknowledged: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};
const ST_KEY: Record<string, string> = { new: "lab.crit.st.new", "escalated-1": "lab.crit.st.esc1", "escalated-2": "lab.crit.st.esc2", acknowledged: "lab.crit.st.ack" };

export default function CriticalTab() {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const { data, loading, error, reload } = useLab<LabWorklist>("/api/staff/lab/worklist");
  const [now, setNow] = useState(() => Date.now());
  const [openLog, setOpenLog] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);

  const ack = async (a: CriticalAlertRow) => {
    setBusy(a.id);
    try {
      await apiPost("/api/staff/lab/ack-critical", { alertId: a.id });
      toast({ title: `✅ ${t("lab.crit.acked")}`, description: `${a.test} — ${a.patient.nameAr}` });
      reload();
    } catch (e) {
      toast({ title: t("common.error"), description: errText(e, lang), variant: "destructive" });
    } finally { setBusy(null); }
  };

  const rows = data?.criticalAlerts ?? [];

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">{t("lab.crit.hint")}</p>

      <LabPanel loading={loading} error={error} onRetry={reload} isEmpty={rows.length === 0}>
        <div className="rounded-lg border overflow-x-auto">
          <Table className="text-xs">
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="h-9 min-w-32">{t("lab.res.test")}</TableHead>
                <TableHead className="h-9 min-w-24">{t("lab.res.value")}</TableHead>
                <TableHead className="h-9 min-w-44">{t("common.name")}</TableHead>
                <TableHead className="h-9 w-24">{t("common.status")}</TableHead>
                <TableHead className="h-9 w-28">{t("lab.crit.elapsed")}</TableHead>
                <TableHead className="h-9 w-64 text-end">{t("common.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((a) => {
                const minutes = Math.max(0, Math.floor((now - new Date(a.notifiedAt).getTime()) / 60000));
                const late = a.status.startsWith("escalated") || minutes >= 10;
                return (
                  <TableRow key={a.id} className={cn("[&>td]:py-2 [&>td]:px-2", late && "bg-red-50/70 dark:bg-red-950/20")}>
                    <TableCell className="font-medium">{a.test}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono tabular-nums font-bold">{a.value ?? "—"}</span>
                        <span className="text-muted-foreground">{a.unit}</span>
                        <FlagBadge flag="CRIT" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-medium truncate max-w-40">{a.patient.nameAr}</span>
                        <span className="font-mono text-muted-foreground">{a.patient.mrn}</span>
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="outline" className={cn("border-transparent text-[10px] font-semibold", ST_TONE[a.status] ?? ST_TONE.new)}>{t(ST_KEY[a.status] ?? "lab.crit.st.new")}</Badge></TableCell>
                    <TableCell>
                      <span className={cn("inline-flex rounded-md px-1.5 py-0.5 font-mono text-[11px] font-bold tabular-nums", late ? "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200" : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200")}>
                        ⏱ {t("lab.crit.since", { n: minutes })}
                      </span>
                    </TableCell>
                    <TableCell className="text-end">
                      <div className="inline-flex flex-col gap-1 items-end">
                        <Button size="sm" className="h-9 px-3 text-[11px] font-bold bg-red-600 hover:bg-red-700" disabled={busy === a.id} onClick={() => ack(a)}>
                          {busy === a.id ? "…" : `🚨 ${t("lab.crit.ack")}`}
                        </Button>
                        <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] text-muted-foreground" onClick={() => setOpenLog(openLog === a.id ? null : a.id)}>
                          {openLog === a.id ? "▲" : "▼"} {t("lab.crit.log")}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {openLog && rows.find((a) => a.id === openLog) && (
          <div className="mt-3 rounded-lg border p-3">
            <div className="text-xs font-semibold mb-2">{t("lab.crit.log")} — {rows.find((a) => a.id === openLog)!.test}</div>
            <ol className="relative border-s-2 ps-4 grid gap-2.5">
              {rows.find((a) => a.id === openLog)!.log.map((l, i) => (
                <li key={i} className="relative">
                  <span aria-hidden className="absolute -start-[21px] top-1 size-2.5 rounded-full bg-red-500" />
                  <div className="text-xs font-medium">{l.ev}</div>
                  <div className="font-mono text-[10px] text-muted-foreground" dir="ltr">{l.at}{l.who ? ` · ${l.who}` : ""}</div>
                </li>
              ))}
            </ol>
          </div>
        )}
      </LabPanel>

      <Card className="gap-3 border-red-200 dark:border-red-900">
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm">⏰ {t("lab.crit.esc.title")}</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 pt-0">
          <ol className="grid gap-2 text-xs">
            <li className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2"><Badge variant="outline" className="font-mono border-transparent bg-zinc-200 dark:bg-zinc-800">0′</Badge>{t("lab.crit.esc.0")}</li>
            <li className="flex items-center gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 px-3 py-2"><Badge variant="outline" className="font-mono border-transparent bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200">+10′</Badge>{t("lab.crit.esc.10")}</li>
            <li className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-950/40 px-3 py-2"><Badge variant="outline" className="font-mono border-transparent bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200">+20′</Badge>{t("lab.crit.esc.20")}</li>
          </ol>
          <Alert className="mt-3">
            <AlertTitle>{t("lab.crit.ack")}</AlertTitle>
            <AlertDescription>{t("lab.crit.hint")}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
