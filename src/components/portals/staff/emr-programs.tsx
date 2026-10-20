"use client";
/**
 * emr-programs — البرامج العلاجية (therapeutic pathways): enroll dialog
 * (template select), active instance progress as step chips (done/current/
 * pending), "إكمال الخطوة الحالية" advance button, past instances list.
 * Separate section component for the summary tab (G2).
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
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, ClipboardList, Footprints } from "lucide-react";
import { Empty, ErrorBox, LoadingRows, Section, errText, type ChartData } from "./emr-shared";
import { cn } from "@/lib/utils";

export interface PathwayStep { key?: string; ar?: string; en?: string }
export interface PathwayTpl { id: string; code: string; nameAr: string; nameEn: string; steps: PathwayStep[] }
export interface ProgramInstance {
  id: string; status: string; currentStep: number; startedAt: string; completedAt: string | null;
  pathway: { id: string; code: string; nameAr: string; nameEn: string; steps: PathwayStep[] };
}

// mirrors server RBAC (perm.ts): view = CLINICAL_VIEWERS, write = SIGNERS + nurse
const PROG_VIEWERS = new Set(["doctor", "dentist", "surgeon", "oncologist", "psychiatrist", "nutritionist", "pediatrician", "nurse", "med-director", "dept-head"]);
const PROG_WRITERS = new Set(["doctor", "dentist", "surgeon", "oncologist", "psychiatrist", "nutritionist", "pediatrician", "nurse"]);

function usePrograms(patientId: string): { instances: ProgramInstance[]; templates: PathwayTpl[]; loading: boolean; error: string | null; reload: () => void } {
  const { lang } = useI18n();
  const [instances, setInstances] = useState<ProgramInstance[]>([]);
  const [templates, setTemplates] = useState<PathwayTpl[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const ctrl = new AbortController();
    setError(null);
    Promise.all([
      apiGet<ProgramInstance[]>(`/api/staff/pathways/for-patient?id=${encodeURIComponent(patientId)}`, ctrl.signal),
      apiGet<PathwayTpl[]>("/api/staff/pathways/list", ctrl.signal),
    ])
      .then(([inst, tpls]) => { if (!ctrl.signal.aborted) { setInstances(inst); setTemplates(tpls); setLoaded(true); } })
      .catch((e) => { if (!ctrl.signal.aborted) setError(errText(e, lang)); });
    return () => ctrl.abort();
  }, [patientId, tick, lang]);
  const reload = useCallback(() => setTick((x) => x + 1), []);
  return { instances, templates, loading: !loaded && error === null, error, reload };
}

function StepChips({ inst }: { inst: ProgramInstance }) {
  const { t, lang } = useI18n();
  const steps = inst.pathway.steps;
  if (steps.length === 0) return null;
  return (
    <ol className="flex flex-wrap items-center gap-1.5" aria-label={t("emr.pro.steps")}>
      {steps.map((s, i) => {
        const done = inst.status === "done" || i < inst.currentStep;
        const current = inst.status === "active" && i === inst.currentStep;
        return (
          <li key={s.key ?? i} className={cn("flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs",
            done ? "border-transparent bg-teal-100 text-teal-900 dark:bg-teal-950 dark:text-teal-200"
              : current ? "border-primary bg-primary/10 text-primary font-semibold"
                : "border-dashed text-muted-foreground")}>
            <span className={cn("grid size-4 place-items-center rounded-full text-[9px] font-bold", done ? "bg-teal-600 text-white" : current ? "bg-primary text-primary-foreground" : "bg-muted")} aria-hidden>
              {done ? <Check className="size-3" /> : i + 1}
            </span>
            <span className="truncate max-w-32">{bi(lang, s.ar, s.en)}</span>
            <span className="sr-only">{done ? t("emr.pro.step.done") : current ? t("emr.pro.step.current") : t("emr.pro.step.pending")}</span>
          </li>
        );
      })}
    </ol>
  );
}

function EnrollDialog({ patientId, templates, excluded, open, onClose, onDone }: { patientId: string; templates: PathwayTpl[]; excluded: Set<string>; open: boolean; onClose: () => void; onDone: () => void }) {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const [pathwayId, setPathwayId] = useState("");
  const [busy, setBusy] = useState(false);
  const available = templates.filter((tpl) => !excluded.has(tpl.id));

  const submit = async () => {
    setBusy(true);
    try {
      const r = await apiPost<{ pathway: string }>("/api/staff/pathways/enroll", { patientId, pathwayId });
      toast({ title: t("emr.pro.enrolled"), description: r.pathway });
      setPathwayId("");
      onDone(); onClose();
    } catch (e) {
      toast({ title: t("common.error"), description: errText(e, lang), variant: "destructive" });
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Footprints className="size-4" aria-hidden />{t("emr.pro.enroll")}</DialogTitle>
          <DialogDescription>{t("emr.pro.enrollDesc")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-1.5">
          <Label htmlFor="pro-pathway">{t("emr.pro.pick")}</Label>
          <Select value={pathwayId} onValueChange={setPathwayId}>
            <SelectTrigger id="pro-pathway" className="h-11 text-sm"><SelectValue placeholder={t("emr.pro.pick")} /></SelectTrigger>
            <SelectContent>
              {available.map((tpl) => (
                <SelectItem key={tpl.id} value={tpl.id} className="text-sm">
                  {bi(lang, tpl.nameAr, tpl.nameEn)} <span className="font-mono text-[10px] text-muted-foreground ms-1" dir="ltr">{tpl.code} · {tpl.steps.length}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {available.length === 0 && <p className="text-xs text-muted-foreground">{t("emr.pro.allActive")}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" className="min-h-11" onClick={onClose}>{t("common.close")}</Button>
          <Button className="min-h-11" disabled={!pathwayId || busy} onClick={submit}>{busy ? t("common.loading") : t("emr.pro.enroll")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ProgramsCard({ chart, reload }: { chart: ChartData; reload: () => void }) {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const role = useApp((s) => s.staff?.role ?? "");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const { instances, templates, loading, error, reload: reloadProgs } = usePrograms(chart.banner.id);
  const active = instances.filter((i) => i.status === "active");
  const past = instances.filter((i) => i.status !== "active");
  const excluded = new Set(instances.filter((i) => i.status === "active").map((i) => i.pathway.id));

  const advance = async (inst: ProgramInstance) => {
    setBusy(true);
    try {
      const r = await apiPost<{ completed: boolean; currentStep: number }>("/api/staff/pathways/advance", { instanceId: inst.id });
      toast({ title: r.completed ? t("emr.pro.completed") : t("emr.pro.advanced"), description: `${bi(lang, inst.pathway.nameAr, inst.pathway.nameEn)} · ${r.currentStep}/${inst.pathway.steps.length}` });
      reloadProgs(); reload();
    } catch (e) {
      toast({ title: t("common.error"), description: errText(e, lang), variant: "destructive" });
    } finally { setBusy(false); }
  };

  return (
    <Section
      title={<><Footprints className="size-4 shrink-0" aria-hidden />{t("emr.pro.title")}</>}
      className="lg:col-span-2"
      actions={PROG_WRITERS.has(role) ? <Button size="sm" className="min-h-11" onClick={() => setOpen(true)}>{t("emr.pro.enroll")}</Button> : undefined}
    >
      {!PROG_VIEWERS.has(role) ? (
        <p className="text-sm text-muted-foreground p-2">{t("emr.pro.norole")}</p>
      ) : loading ? (
        <LoadingRows n={2} />
      ) : error ? (
        <ErrorBox message={error} onRetry={reloadProgs} />
      ) : instances.length === 0 ? (
        <Empty label={t("emr.pro.none")} className="py-4" />
      ) : (
        <div className="grid gap-3">
          {active.map((inst) => (
            <div key={inst.id} className="rounded-lg border p-3 grid gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <ClipboardList className="size-4 shrink-0 text-primary" aria-hidden />
                <span className="text-sm font-semibold">{bi(lang, inst.pathway.nameAr, inst.pathway.nameEn)}</span>
                <Badge variant="outline" className="font-mono text-[10px] bg-teal-50" dir="ltr">{inst.pathway.code}</Badge>
                <Badge variant="outline" className="border-transparent bg-emerald-100 text-emerald-900 text-[10px] dark:bg-emerald-950 dark:text-emerald-200">{t("status.active")}</Badge>
                <span className="text-[11px] text-muted-foreground font-mono tabular-nums">{t("emr.pro.started")}: {bhDateString(inst.startedAt)}</span>
                <span className="ms-auto text-xs text-muted-foreground">{t("emr.pro.current")} <b className="font-mono">{inst.currentStep + 1}</b> / {inst.pathway.steps.length}</span>
              </div>
              <StepChips inst={inst} />
              {PROG_WRITERS.has(role) && (
                <div className="flex items-center gap-2">
                  <Button size="sm" className="min-h-11" disabled={busy || inst.pathway.steps.length === 0} onClick={() => advance(inst)}>
                    <Check className="size-4" aria-hidden />{t("emr.pro.advance")}
                  </Button>
                  <span className="text-[11px] text-muted-foreground">{t("emr.pro.advanceHint")}</span>
                </div>
              )}
            </div>
          ))}
          {past.length > 0 && (
            <ul className="grid gap-1.5 max-h-40 overflow-y-auto bmc-scroll" role="list">
              {past.map((inst) => (
                <li key={inst.id} className="flex flex-wrap items-center gap-2 rounded-md border p-2 text-sm">
                  <span className="truncate font-medium max-w-56">{bi(lang, inst.pathway.nameAr, inst.pathway.nameEn)}</span>
                  <Badge variant="outline" className={cn("text-[10px] border-transparent", inst.status === "done" ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200" : "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300")}>{t(`emr.pro.st.${inst.status}`)}</Badge>
                  <span className="font-mono text-xs text-muted-foreground tabular-nums">{bhDateString(inst.startedAt)}</span>
                  {inst.completedAt && <span className="font-mono text-xs text-muted-foreground tabular-nums">→ {bhDateString(inst.completedAt)}</span>}
                  <span className="ms-auto font-mono text-[10px] text-muted-foreground">{inst.pathway.steps.length > 0 ? `${inst.currentStep}/${inst.pathway.steps.length}` : ""}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {templates.length > 0 && (
        <EnrollDialog patientId={chart.banner.id} templates={templates} excluded={excluded} open={open} onClose={() => setOpen(false)} onDone={() => { reloadProgs(); reload(); }} />
      )}
    </Section>
  );
}
