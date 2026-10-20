"use client";
/**
 * emr-consents — الموافقات: per-patient consent ledger + pending hard-stops
 * banner + tablet capture dialog (min-read timer, §19 templates).
 */
import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/api-client";
import { useI18n, bi } from "@/i18n";
import { useToast } from "@/hooks/use-toast";
import { bhDateString } from "@/lib/bahrain";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/shared/badges";
import { Check, FileSignature, OctagonX, Plus } from "lucide-react";
import { Empty, ErrorBox, LoadingRows, Section, errText, type ChartData } from "./emr-shared";

interface Props { chart: ChartData; reload: () => void }
interface Tpl { key: string; version: number; titleAr: string; titleEn: string; bodyAr: string; bodyEn: string; hardStop: boolean; validDays: number; minReadSec: number }
interface ConsentRow { id: string; code: string; templateKey: string; status: string; method: string; signedBy: string | null; signedAt: string; readSeconds: number }

export function ConsentsTab({ chart }: Props) {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const pid = chart.banner.id;
  const [rows, setRows] = useState<ConsentRow[] | null>(null);
  const [hardStops, setHardStops] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Tpl[]>([]);
  const [open, setOpen] = useState(false);
  const [tplKey, setTplKey] = useState("");
  const [signedBy, setSignedBy] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setError(null);
    apiGet<{ consents: ConsentRow[]; hardStopsPending: string[] }>(`/api/staff/consents/for-patient?patientId=${pid}`)
      .then((r) => { setRows(r.consents); setHardStops(r.hardStopsPending); })
      .catch((e) => { setError(errText(e, lang)); setRows([]); });
  }, [pid, lang]);
  useEffect(load, [load]);

  useEffect(() => {
    apiGet<Tpl[]>("/api/staff/consents/templates").then(setTemplates).catch(() => null);
  }, []);

  // read-timer: ticks up while the capture dialog is open w/ a template body shown
  useEffect(() => {
    if (!open || !tplKey) return;
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [open, tplKey]);

  const openCapture = () => { setElapsed(0); setTplKey(""); setSignedBy(""); setOpen(true); };
  const pickTpl = (k: string) => { setElapsed(0); setTplKey(k); };

  const tpl = templates.find((x) => x.key === tplKey) ?? null;
  const remaining = tpl ? Math.max(0, tpl.minReadSec - elapsed) : 0;
  const progress = tpl && tpl.minReadSec > 0 ? Math.min(100, (elapsed / tpl.minReadSec) * 100) : 100;
  const titleOf = (key: string) => bi(lang, templates.find((x) => x.key === key)?.titleAr ?? key, templates.find((x) => x.key === key)?.titleEn ?? key);

  const capture = async () => {
    if (!tpl) return;
    setBusy(true);
    try {
      const r = await apiPost<{ code: string }>("/api/staff/consents/capture", {
        patientId: pid, templateKey: tpl.key, method: "tablet", signedBy: signedBy.trim(), readSeconds: elapsed,
      });
      toast({ title: t("emr.con.ok", { code: r.code }), description: bi(lang, tpl.titleAr, tpl.titleEn) });
      setOpen(false); setTplKey(""); setSignedBy("");
      load();
    } catch (e) {
      const code = (e as { problem?: { code?: string } }).problem?.code;
      toast({ title: code === "READ_TOO_FAST" ? t("emr.con.toofast") : t("common.error"), description: errText(e, lang), variant: "destructive" });
    } finally { setBusy(false); }
  };

  return (
    <div className="grid gap-3">
      {hardStops.length > 0 && (
        <div role="alert" className="rounded-xl border-2 border-red-400 bg-red-50 dark:bg-red-950/40 p-4 grid gap-2">
          <b className="text-sm text-red-900 dark:text-red-200 flex items-center gap-2"><OctagonX className="size-4 shrink-0" aria-hidden />{t("emr.con.hardstop")}</b>
          <div className="flex flex-wrap gap-1.5">
            {hardStops.map((k) => <Badge key={k} variant="outline" className="border-red-300 text-red-800 dark:text-red-200 bg-red-100/60 dark:bg-red-950 text-xs">{titleOf(k)}</Badge>)}
          </div>
          <span className="text-xs text-red-700 dark:text-red-300">{t("emr.con.hardstopNote")}</span>
        </div>
      )}

      <Section title={<><FileSignature className="size-4 shrink-0" aria-hidden />{t("emr.tab.consents")}</>} actions={<Button size="sm" className="h-7 text-[11px]" onClick={openCapture}><Plus className="size-3.5" aria-hidden />{t("emr.con.capture")}</Button>}>
        {error && <ErrorBox message={error} onRetry={load} />}
        {!rows && !error && <LoadingRows n={3} />}
        {rows && rows.length === 0 && <Empty label={t("emr.con.none")} className="py-4" />}
        {rows && rows.length > 0 && (
          <ul className="grid gap-1.5 max-h-80 overflow-y-auto bmc-scroll">
            {rows.map((c) => (
              <li key={c.id} className="rounded-md border p-2 flex flex-wrap items-center gap-2 text-xs">
                <span className="font-mono font-bold" dir="ltr">{c.code}</span>
                <span className="truncate max-w-56">{titleOf(c.templateKey)}</span>
                <Badge variant="outline" className="text-[10px] font-mono">{c.method}</Badge>
                <span className="text-muted-foreground">{bhDateString(c.signedAt)}</span>
                {c.signedBy && <span className="text-muted-foreground">· {c.signedBy}</span>}
                <span className="ms-auto flex items-center gap-1.5"><StatusBadge status={c.status} /></span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2"><FileSignature className="size-4 shrink-0" aria-hidden />{t("emr.con.capture")}</DialogTitle>
            <DialogDescription className="text-xs">{t("emr.con.captureDesc")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1">
              <Label className="text-xs text-muted-foreground">{t("emr.con.template")}</Label>
              <Select value={tplKey || undefined} onValueChange={pickTpl}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder={t("common.select")} /></SelectTrigger>
                <SelectContent className="max-h-64">
                  {templates.map((x) => (
                    <SelectItem key={x.key} value={x.key} className="text-xs">
                      {bi(lang, x.titleAr, x.titleEn)}
                      {x.hardStop && <Badge variant="outline" className="ms-1 text-[9px] border-red-300 text-red-700">hard-stop</Badge>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {tpl && (
              <>
                <Textarea readOnly rows={7} value={bi(lang, tpl.bodyAr, tpl.bodyEn)} className="text-xs leading-6" aria-label={t("emr.con.body")} />
                <div className="grid gap-1">
                  <div className="flex items-center gap-2 text-xs">
                    <Progress value={progress} className="h-2 flex-1" />
                    <span className="font-mono tabular-nums inline-flex items-center gap-1" dir="ltr">{remaining > 0 ? `${remaining}s / ${tpl.minReadSec}s` : <><Check className="size-3.5" aria-hidden />{`${elapsed}s`}</>}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">{remaining > 0 ? t("emr.con.reading") : t("emr.con.readok")}</span>
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="con-signedby" className="text-xs text-muted-foreground">{t("emr.con.signedby")}</Label>
                  <Input id="con-signedby" value={signedBy} onChange={(e) => setSignedBy(e.target.value)} className="h-9 text-sm" placeholder={t("emr.con.signedbyHint")} />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
            <Button size="sm" disabled={!tpl || !signedBy.trim() || remaining > 0 || busy} onClick={capture}>{t("common.submit")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
