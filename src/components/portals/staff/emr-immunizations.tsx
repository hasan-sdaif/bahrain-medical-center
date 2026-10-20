"use client";
/**
 * emr-immunizations — التطعيمات: immunization history + due/overdue schedule
 * (server-computed) + "تسجيل تطعيم" dialog (whitelist vaccine, dose, date,
 * batch, injection site). Separate section component for the summary tab (G1).
 */
import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/api-client";
import { useI18n, bi } from "@/i18n";
import { useToast } from "@/hooks/use-toast";
import { useApp } from "@/store/app";
import { bhDateString } from "@/lib/bahrain";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarClock, Syringe, TriangleAlert } from "lucide-react";
import { Empty, ErrorBox, LoadingRows, Section, errText, type ChartData } from "./emr-shared";

export interface ImmRow { id: string; vaccine: string; vaccineEn: string | null; doseLabel: string; givenAt: string; batch: string | null; site: string | null; nextDueAt: string | null }
export interface ImmDue { code: string; ar: string; en: string; dose: number; dueAt: string; status: string }
export interface ImmResp { given: ImmRow[]; due: ImmDue[]; catalog: { code: string; ar: string; en: string }[] }

const IMM_VIEWERS = new Set(["doctor", "dentist", "surgeon", "oncologist", "psychiatrist", "nutritionist", "pediatrician", "nurse", "med-director", "dept-head"]);
const IMM_WRITERS = new Set(["doctor", "dentist", "surgeon", "oncologist", "psychiatrist", "nutritionist", "pediatrician", "nurse"]);
const SITES = ["arm-r", "arm-l", "thigh-r", "thigh-l"] as const;
const todayBh = () => new Date(Date.now() + 3 * 3600000).toISOString().slice(0, 10);

function doseOf(label: string, t: (k: string, v?: Record<string, string | number>) => string): string {
  const m = /^الجرعة\s*(\d+)$/.exec(label.trim()) ?? /^(\d+)$/.exec(label.trim());
  return m ? t("emr.imm.doseN", { n: m[1] }) : label;
}

function useImmData(patientId: string): { data: ImmResp | null; loading: boolean; error: string | null; reload: () => void } {
  const { lang } = useI18n();
  const [data, setData] = useState<ImmResp | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const ctrl = new AbortController();
    apiGet<ImmResp>(`/api/staff/immunizations/for-patient?id=${encodeURIComponent(patientId)}`, ctrl.signal)
      .then((d) => { if (!ctrl.signal.aborted) { setData(d); setError(null); } })
      .catch((e) => { if (!ctrl.signal.aborted) setError(errText(e, lang)); });
    return () => ctrl.abort();
  }, [patientId, tick, lang]);
  const reload = useCallback(() => setTick((x) => x + 1), []);
  return { data, loading: data === null && error === null, error, reload };
}

function RecordDialog({ patientId, open, onClose, onDone, catalog }: { patientId: string; open: boolean; onClose: () => void; onDone: () => void; catalog: { code: string; ar: string; en: string }[] }) {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const [vaccine, setVaccine] = useState("");
  const [doseNo, setDoseNo] = useState("1");
  const [date, setDate] = useState(todayBh());
  const [batch, setBatch] = useState("");
  const [site, setSite] = useState<string>("arm-r");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await apiPost("/api/staff/immunizations/record", { patientId, vaccine, doseNo: Number(doseNo) || 1, date, batch: batch.trim() || undefined, site });
      toast({ title: t("emr.imm.recorded"), description: `${doseOf(String(Number(doseNo) || 1), t)} · ${bhDateString(date)}` });
      setVaccine(""); setDoseNo("1"); setDate(todayBh()); setBatch(""); setSite("arm-r");
      onDone(); onClose();
    } catch (e) {
      toast({ title: t("common.error"), description: errText(e, lang), variant: "destructive" });
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Syringe className="size-4" aria-hidden />{t("emr.imm.record")}</DialogTitle>
          <DialogDescription>{t("emr.imm.recordDesc")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>{t("emr.imm.vaccine")}</Label>
            <Select value={vaccine} onValueChange={setVaccine}>
              <SelectTrigger className="h-11 text-sm"><SelectValue placeholder={t("emr.imm.needVaccine")} /></SelectTrigger>
              <SelectContent>
                {catalog.map((v) => <SelectItem key={v.code} value={v.code} className="text-sm">{bi(lang, v.ar, v.en)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="imm-dose">{t("emr.imm.dose")}</Label>
              <Input id="imm-dose" type="number" min={1} max={9} inputMode="numeric" dir="ltr" value={doseNo} onChange={(e) => setDoseNo(e.target.value)} className="h-11 font-mono" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="imm-date">{t("emr.imm.date")}</Label>
              <Input id="imm-date" type="date" dir="ltr" value={date} onChange={(e) => setDate(e.target.value)} className="h-11 font-mono" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="imm-batch">{t("emr.imm.batch")}</Label>
              <Input id="imm-batch" value={batch} onChange={(e) => setBatch(e.target.value)} placeholder="LOT-…" className="h-11 font-mono" dir="ltr" />
            </div>
            <div className="grid gap-1.5">
              <Label>{t("emr.imm.site")}</Label>
              <Select value={site} onValueChange={setSite}>
                <SelectTrigger className="h-11 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SITES.map((s) => <SelectItem key={s} value={s} className="text-sm">{t(`emr.imm.site.${s}`)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <p className="text-xs text-muted-foreground flex-1">{!vaccine && (<span className="inline-flex items-center gap-1.5"><TriangleAlert className="size-3.5 shrink-0" aria-hidden />{t("emr.imm.needVaccine")}</span>)}</p>
          <Button variant="outline" className="min-h-11" onClick={onClose}>{t("common.cancel")}</Button>
          <Button className="min-h-11" disabled={!vaccine || busy} onClick={submit}>{busy ? t("common.loading") : t("emr.imm.record")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ImmunizationsCard({ chart, reload }: { chart: ChartData; reload: () => void }) {
  const { t, lang } = useI18n();
  const role = useApp((s) => s.staff?.role ?? "");
  const [open, setOpen] = useState(false);
  const { data, loading, error, reload: reloadImm } = useImmData(chart.banner.id);
  const given = data?.given ?? [];
  const due = data?.due ?? [];
  const now = Date.now();

  return (
    <Section
      title={<><Syringe className="size-4 shrink-0" aria-hidden />{t("emr.imm.title")}</>}
      className="lg:col-span-2"
      actions={IMM_WRITERS.has(role) ? <Button size="sm" className="min-h-11" onClick={() => setOpen(true)}>{t("emr.imm.record")}</Button> : undefined}
    >
      {!IMM_VIEWERS.has(role) ? (
        <p className="text-sm text-muted-foreground p-2">{t("emr.imm.norole")}</p>
      ) : loading ? (
        <LoadingRows n={2} />
      ) : error ? (
        <ErrorBox message={error} onRetry={reloadImm} />
      ) : (
        <div className="grid gap-3">
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-1.5">{t("emr.imm.history")}</p>
            {given.length === 0 ? <Empty label={t("emr.imm.none")} className="py-3" /> : (
              <ul className="grid gap-1.5 max-h-72 overflow-y-auto bmc-scroll" role="list">
                {given.map((i) => (
                  <li key={i.id} className="flex flex-wrap items-center gap-2 rounded-md border p-2 text-sm">
                    <span className="truncate font-medium">{bi(lang, i.vaccine, i.vaccineEn)}</span>
                    <Badge variant="outline" className="bg-teal-50 text-[10px]">{doseOf(i.doseLabel, t)}</Badge>
                    <span className="font-mono text-xs text-muted-foreground tabular-nums" dir="ltr">{bhDateString(i.givenAt)}</span>
                    {i.batch && <Badge variant="outline" className="font-mono text-[10px]" dir="ltr">{i.batch}</Badge>}
                    {i.site && <Badge variant="outline" className="text-[10px]">{t(`emr.imm.site.${i.site}`)}</Badge>}
                    {i.nextDueAt && (new Date(i.nextDueAt).getTime() <= now
                      ? <Badge variant="outline" className="ms-auto border-transparent bg-red-100 text-red-900 text-[10px] font-semibold dark:bg-red-950 dark:text-red-200">{t("emr.imm.overdue")}</Badge>
                      : <Badge variant="outline" className="ms-auto border-transparent bg-amber-100 text-amber-900 text-[10px] font-semibold dark:bg-amber-950 dark:text-amber-200">{t("emr.imm.nextDue")}: <span className="font-mono ms-1" dir="ltr">{bhDateString(i.nextDueAt)}</span></Badge>)}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1.5"><CalendarClock className="size-3.5 shrink-0" aria-hidden />{t("emr.imm.dueList")}</p>
            {due.length === 0 ? (
              <p className="text-sm text-muted-foreground p-2">{t("emr.imm.uptodate")}</p>
            ) : (
              <ul className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto bmc-scroll" role="list">
                {due.map((d) => (
                  <li key={`${d.code}-${d.dose}`} className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs">
                    <span className="font-medium">{bi(lang, d.ar, d.en)}</span>
                    <span className="text-muted-foreground">{doseOf(String(d.dose), t)}</span>
                    <span className="font-mono text-[10px] text-muted-foreground tabular-nums" dir="ltr">{bhDateString(d.dueAt)}</span>
                    <Badge variant="outline" className={d.status === "overdue"
                      ? "border-transparent bg-red-600 text-white text-[10px] font-semibold"
                      : d.status === "due"
                        ? "border-transparent bg-amber-100 text-amber-900 text-[10px] font-semibold dark:bg-amber-950 dark:text-amber-200"
                        : "border-transparent bg-zinc-100 text-zinc-700 text-[10px] dark:bg-zinc-800 dark:text-zinc-300"}>{t(`emr.imm.${d.status}`)}</Badge>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-[10px] text-muted-foreground mt-2">{t("emr.imm.schedNote")}</p>
          </div>
        </div>
      )}
      {data?.catalog && <RecordDialog patientId={chart.banner.id} open={open} onClose={() => setOpen(false)} onDone={() => { reloadImm(); reload(); }} catalog={data.catalog} />}
    </Section>
  );
}
