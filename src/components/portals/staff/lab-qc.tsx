"use client";
/**
 * ضبط الجودة — Westgard QC runs table, Levey-Jennings chart (recharts, target
 * mean + ±1SD/±2SD dashed reference lines, SD estimated as 10% of target) and
 * the new-run form (CBC/HGB/K/GLU-F × levels 1-3).
 */
import { useMemo, useState } from "react";
import { useI18n } from "@/i18n";
import { apiPost } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { cn } from "@/lib/utils";
import { LabPanel, errText, useLab, type QcResp, type QcRow } from "./lab-shared";

const QC_TESTS = ["CBC", "HGB", "K", "GLU-F"] as const;

function QcBadge({ status }: { status: string }) {
  const { t } = useI18n();
  const tone = status === "passed"
    ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
    : status === "warned"
      ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
      : "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200 animate-pulse";
  return <Badge variant="outline" className={cn("border-transparent text-[10px] font-semibold", tone)}>{t(`lab.qc.${status}`)}</Badge>;
}

export default function QcTab() {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const { data, loading, error, reload } = useLab<QcRow[]>("/api/staff/lab/qc");
  const [testCode, setTestCode] = useState<string>("CBC");
  const [level, setLevel] = useState("1");
  const [target, setTarget] = useState("");
  const [observed, setObserved] = useState("");
  const [busy, setBusy] = useState(false);
  const runs = data ?? [];

  // Levey-Jennings: chronological points for the latest run's test, SD = 10% of its target.
  const latest = runs[0];
  const chartRuns = useMemo(() => (latest?.testId ? runs.filter((r) => r.testId === latest.testId).slice().reverse() : []), [runs, latest]);
  const mean = latest?.target ?? 0;
  const sd1 = mean * 0.1;
  const sd2 = mean * 0.2;
  const chartData = chartRuns.map((r, i) => ({ i: i + 1, v: r.observed }));

  const submit = async () => {
    if (!Number.isFinite(Number(target)) || !Number.isFinite(Number(observed)) || target === "" || observed === "") {
      toast({ title: t("common.error"), description: t("lab.qc.needNum"), variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const r = await apiPost<QcResp>("/api/staff/lab/qc", { testCode, level: Number(level), target: Number(target), observed: Number(observed) });
      const statusAr = t(`lab.qc.${r.status}`);
      if (r.status === "failed") toast({ title: t("lab.qc.runBad", { rule: r.rule ?? "1-3s" }), description: statusAr, variant: "destructive" });
      else toast({ title: t("lab.qc.runOk", { status: statusAr }), description: r.rule ? `Westgard ${r.rule}` : undefined });
      setObserved("");
      reload();
    } catch (e) {
      toast({ title: t("common.error"), description: errText(e, lang), variant: "destructive" });
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">{t("lab.qc.hint")}</p>

      <LabPanel loading={loading} error={error} onRetry={reload} isEmpty={runs.length === 0}>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border overflow-x-auto">
            <Table className="text-xs">
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="h-9 min-w-24">{t("lab.qc.test")}</TableHead>
                  <TableHead className="h-9 w-14">{t("lab.qc.level")}</TableHead>
                  <TableHead className="h-9 w-16">{t("lab.qc.target")}</TableHead>
                  <TableHead className="h-9 w-16">{t("lab.qc.observed")}</TableHead>
                  <TableHead className="h-9 w-20">{t("lab.qc.dev")}</TableHead>
                  <TableHead className="h-9 w-20">{t("common.status")}</TableHead>
                  <TableHead className="h-9 w-16">{t("lab.qc.rule")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((r) => {
                  const dev = r.observed - r.target;
                  return (
                    <TableRow key={r.id} className="[&>td]:py-1.5 [&>td]:px-2">
                      <TableCell className="font-mono text-[10px] truncate max-w-24" title={r.testId ?? ""}>{r.testId ? `${r.testId.slice(0, 10)}…` : "—"}</TableCell>
                      <TableCell className="font-mono">L{r.level}</TableCell>
                      <TableCell className="font-mono tabular-nums">{r.target}</TableCell>
                      <TableCell className="font-mono tabular-nums font-semibold">{r.observed}</TableCell>
                      <TableCell className={cn("font-mono tabular-nums", Math.abs(dev / (r.target || 1)) > 0.15 && "text-red-600 dark:text-red-400 font-bold")}>{dev >= 0 ? "+" : ""}{dev.toFixed(2)}</TableCell>
                      <TableCell><QcBadge status={r.status} /></TableCell>
                      <TableCell className="font-mono text-[10px]">{r.rule ?? "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <Card className="gap-2">
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm">📈 {t("lab.qc.chart")}</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0">
              <p className="text-[11px] text-muted-foreground mb-1">{t("lab.qc.chartHint")}</p>
              {chartData.length === 0 ? (
                <div className="h-56 grid place-items-center text-xs text-muted-foreground">{t("common.empty")}</div>
              ) : (
                <div dir="ltr">
                  <ResponsiveContainer width="100%" height={224}>
                    <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#d4d4d8" />
                      <XAxis dataKey="i" tick={{ fontSize: 10 }} label={{ value: "#", position: "insideBottomRight", fontSize: 9 }} />
                      <YAxis domain={["auto", "auto"]} tick={{ fontSize: 10 }} width={44} />
                      <Tooltip formatter={(v) => [Number(v).toFixed(2), t("lab.qc.observed")]} labelFormatter={(i) => `#${i}`} />
                      <ReferenceLine y={mean} stroke="#0d9488" strokeWidth={2} label={{ value: "μ", fontSize: 9, fill: "#0d9488", position: "left" }} />
                      <ReferenceLine y={mean + sd1} stroke="#d97706" strokeDasharray="6 4" label={{ value: "+1SD", fontSize: 9, fill: "#d97706", position: "right" }} />
                      <ReferenceLine y={mean - sd1} stroke="#d97706" strokeDasharray="6 4" label={{ value: "−1SD", fontSize: 9, fill: "#d97706", position: "right" }} />
                      <ReferenceLine y={mean + sd2} stroke="#dc2626" strokeDasharray="3 4" label={{ value: "+2SD", fontSize: 9, fill: "#dc2626", position: "right" }} />
                      <ReferenceLine y={mean - sd2} stroke="#dc2626" strokeDasharray="3 4" label={{ value: "−2SD", fontSize: 9, fill: "#dc2626", position: "right" }} />
                      <Line type="monotone" dataKey="v" stroke="#0891b2" strokeWidth={2} dot={{ r: 3, fill: "#0891b2" }} isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </LabPanel>

      <Card className="gap-3">
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm">🧪 {t("lab.qc.new")}</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 pt-0">
          <div className="flex flex-wrap items-end gap-3">
            <div className="grid gap-1.5 min-w-36">
              <Label>{t("lab.qc.test")}</Label>
              <Select value={testCode} onValueChange={setTestCode}>
                <SelectTrigger className="h-10 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {QC_TESTS.map((c) => <SelectItem key={c} value={c} className="text-xs font-mono">{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5 w-24">
              <Label>{t("lab.qc.level")}</Label>
              <Select value={level} onValueChange={setLevel}>
                <SelectTrigger className="h-10 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["1", "2", "3"].map((l) => <SelectItem key={l} value={l} className="text-xs font-mono">L{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5 w-32">
              <Label htmlFor="lb-qct">{t("lab.qc.target")}</Label>
              <Input id="lb-qct" type="number" step="any" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} className="h-10 font-mono" placeholder="4.5" />
            </div>
            <div className="grid gap-1.5 w-32">
              <Label htmlFor="lb-qco">{t("lab.qc.observed")}</Label>
              <Input id="lb-qco" type="number" step="any" inputMode="decimal" value={observed} onChange={(e) => setObserved(e.target.value)} className="h-10 font-mono" placeholder="4.4" />
            </div>
            <Button className="h-10" disabled={busy} onClick={submit}>{busy ? "…" : t("lab.qc.run")}</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
