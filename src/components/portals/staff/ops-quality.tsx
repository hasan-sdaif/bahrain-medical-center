"use client";
/**
 * Quality & safety tab (agent S4) — NPS KPI row, incident reports with
 * severity ladder (near-miss → sentinel), anonymous no-blame reporting
 * dialog, SLA-tracked complaints and CAPA actions.
 */
import { useState, type FormEvent } from "react";
import { useI18n } from "@/i18n";
import { apiPost } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/shared/badges";
import { AlertTriangle, Clock, Loader2, MessageSquare, Plus, Smile } from "lucide-react";
import { cn } from "@/lib/utils";
import { Countdown, Kpi, Panel, SlaChip, daysUntil, errText, fmtDT, useOps, type QualityResp } from "./ops-shared";

const SEV_TONE: Record<string, string> = {
  "near-miss": "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200",
  minor: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  major: "bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-200",
  sentinel: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200 animate-pulse",
};
const TYPES = ["medication", "fall", "needle", "lab", "service", "security"] as const;
const SEVS = ["near-miss", "minor", "major", "sentinel"] as const;
/** payload type → i18n key segment (medication is keyed as "med") */
const TYPE_KEY: Record<string, string> = { medication: "med", fall: "fall", needle: "needle", lab: "lab", service: "service", security: "security" };
const CSTATUS_TONE: Record<string, string> = {
  investigating: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  responded: "bg-teal-100 text-teal-900 dark:bg-teal-950 dark:text-teal-200",
};

function SevChip({ severity }: { severity: string }) {
  const { t } = useI18n();
  return <Badge variant="outline" className={cn("border-transparent font-medium", SEV_TONE[severity] ?? "")}>{t(`ops.quality.sev.${severity}`)}</Badge>;
}

function IncidentDialog({ open, onOpenChange, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; onDone: () => void }) {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const [type, setType] = useState<string>("medication");
  const [severity, setSeverity] = useState<string>("minor");
  const [desc, setDesc] = useState("");
  const [anon, setAnon] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || !desc.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await apiPost<{ id: string; code: string }>("/api/staff/quality/incident", {
        type, severity, description: desc.trim(), anonymous: anon,
      });
      toast({ title: t("ops.quality.success", { code: res.code }) });
      onDone();
      onOpenChange(false);
      setDesc("");
      setAnon(false);
    } catch (ex) {
      setErr(errText(ex, lang, t("common.error")));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("ops.quality.new")}</DialogTitle>
          <DialogDescription>{t("ops.quality.noblame")}</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="inc-type">{t("ops.quality.type")}</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger id="inc-type" className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPES.map((v) => <SelectItem key={v} value={v}>{t(`ops.quality.type.${TYPE_KEY[v]}`)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inc-sev">{t("ops.quality.severity")}</Label>
              <Select value={severity} onValueChange={setSeverity}>
                <SelectTrigger id="inc-sev" className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SEVS.map((v) => <SelectItem key={v} value={v}>{t(`ops.quality.sev.${v}`)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inc-desc">{t("ops.quality.desc")}</Label>
            <Textarea id="inc-desc" value={desc} onChange={(e) => setDesc(e.target.value)} required
              placeholder={t("ops.quality.desc.ph")} className="min-h-24 text-sm" />
          </div>
          <label htmlFor="inc-anon" className="flex min-h-11 items-center justify-between gap-3 rounded-lg border px-3">
            <span className="text-sm font-medium">{t("ops.quality.noblame")}</span>
            <Switch id="inc-anon" checked={anon} onCheckedChange={setAnon} />
          </label>
          {err ? <Alert variant="destructive"><AlertDescription className="text-sm">{err}</AlertDescription></Alert> : null}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="h-11">{t("common.cancel")}</Button>
            <Button type="submit" disabled={busy || !desc.trim()} className="h-11 min-w-24">
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              {t("common.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function QualityTab() {
  const { t } = useI18n();
  const { data, loading, error, reload } = useOps<QualityResp>("/api/staff/quality/overview");
  const [open, setOpen] = useState(false);
  const inc = data?.incidents ?? [];
  const comp = data?.complaints ?? [];
  const capas = data?.capas ?? [];
  const openInc = inc.filter((i) => i.status !== "closed").length;
  const overSla = comp.filter((c) => c.overSla).length;

  return (
    <div className="space-y-4">
      <Panel loading={loading} error={error} onRetry={reload} isEmpty={!data} rows={6}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi label={t("ops.quality.nps")} value={<span className="font-mono">{data!.nps}</span>} sub={t("ops.quality.surveys", { n: data!.surveyCount })} icon={<Smile className="size-3.5" />} />
          <Kpi label={t("ops.quality.surveys.count")} value={<span className="font-mono">{data!.surveyCount}</span>} icon={<MessageSquare className="size-3.5" />} />
          <Kpi label={t("ops.quality.open")} value={<span className="font-mono">{openInc}</span>} icon={<AlertTriangle className="size-3.5" />} />
          <Kpi label={t("ops.quality.oversla")} value={<span className="font-mono">{overSla}</span>} icon={<Clock className="size-3.5" />} />
        </div>

        <section className="mt-2 space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">{t("ops.quality.incidents")}</h3>
            <Button size="sm" className="h-9" onClick={() => setOpen(true)}>
              <Plus className="size-4" />{t("ops.quality.new")}
            </Button>
          </div>
          <div className="max-h-96 overflow-auto rounded-xl border">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-background">
                <TableRow>
                  <TableHead className="text-start">{t("common.code")}</TableHead>
                  <TableHead className="text-start">{t("ops.quality.severity")}</TableHead>
                  <TableHead className="text-start">{t("common.type")}</TableHead>
                  <TableHead className="text-start">{t("ops.quality.desc")}</TableHead>
                  <TableHead className="text-start">{t("common.status")}</TableHead>
                  <TableHead className="text-start">{t("common.date")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inc.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className="py-2.5 font-mono text-xs">{i.code}</TableCell>
                    <TableCell className="py-2.5"><SevChip severity={i.severity} /></TableCell>
                    <TableCell className="py-2.5">
                      <Badge variant="secondary" className="text-[10px]">{t(`ops.quality.type.${TYPE_KEY[i.type] ?? "other"}`)}</Badge>
                    </TableCell>
                    <TableCell className="max-w-56 truncate py-2.5 text-xs" title={i.description}>{i.description}</TableCell>
                    <TableCell className="py-2.5"><StatusBadge status={i.status} /></TableCell>
                    <TableCell className="py-2.5 font-mono text-[11px] text-muted-foreground">{fmtDT(i.at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>

        <section className="space-y-1.5">
          <h3 className="text-sm font-semibold">{t("ops.quality.complaints")}</h3>
          <div className="max-h-96 overflow-auto rounded-xl border">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-background">
                <TableRow>
                  <TableHead className="text-start">{t("common.code")}</TableHead>
                  <TableHead className="text-start">{t("common.type")}</TableHead>
                  <TableHead className="text-start">{t("ops.quality.desc")}</TableHead>
                  <TableHead className="text-start">{t("common.status")}</TableHead>
                  <TableHead className="text-start">{t("ops.wo.sla")}</TableHead>
                  <TableHead className="text-start">{t("ops.quality.resolution")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {comp.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="py-2.5 font-mono text-xs">{c.code}</TableCell>
                    <TableCell className="py-2.5">
                      <Badge variant="outline" className="text-[10px] font-normal">{t(`ops.quality.cat.${c.category}`)}</Badge>
                    </TableCell>
                    <TableCell className="max-w-56 truncate py-2.5 text-xs" title={c.description}>{c.description}</TableCell>
                    <TableCell className="py-2.5">
                      <StatusBadge status={c.status} className={CSTATUS_TONE[c.status]} />
                    </TableCell>
                    <TableCell className="py-2.5">
                      {c.slaDueAt
                        ? <SlaChip minutes={Math.round((new Date(c.slaDueAt).getTime() - Date.now()) / 60000)} over={c.overSla} />
                        : <span className="text-xs text-muted-foreground">{t("ops.sla.none")}</span>}
                    </TableCell>
                    <TableCell className="max-w-48 truncate py-2.5 text-xs" title={c.resolutionAr ?? undefined}>{c.resolutionAr ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>

        <section className="space-y-1.5">
          <h3 className="text-sm font-semibold">{t("ops.quality.capas")}</h3>
          <ul className="max-h-96 space-y-1.5 overflow-y-auto">
            {capas.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2">
                <span className="font-mono text-xs">{c.code}</span>
                <span className="min-w-0 flex-1 truncate text-xs" title={c.actionAr}>{c.actionAr}</span>
                <StatusBadge status={c.status} />
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  {t("ops.quality.capas.due")}: <span className="font-mono">{c.dueAt ?? "—"}</span>
                  <Countdown days={daysUntil(c.dueAt)} warn={30} danger={7} />
                </span>
              </li>
            ))}
          </ul>
        </section>
      </Panel>

      <IncidentDialog open={open} onOpenChange={setOpen} onDone={reload} />
    </div>
  );
}
