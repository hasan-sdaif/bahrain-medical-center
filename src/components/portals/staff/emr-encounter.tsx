"use client";
/**
 * emr-encounter — اللقاء: encounter select/create + SOAP form + sign (confirm)
 * + finish-visit checklist dialog (توقيع/تشخيص/متابعة/فوترة).
 */
import { useState } from "react";
import { apiPost } from "@/lib/api-client";
import { useI18n } from "@/i18n";
import { useToast } from "@/hooks/use-toast";
import { useApp } from "@/store/app";
import { bhDateString } from "@/lib/bahrain";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/shared/badges";
import { Check, FileSignature, Flag, Lock, Plus, Stethoscope } from "lucide-react";
import { Empty, SIGN_ROLES, Section, errText, type ChartData, type EncounterRow } from "./emr-shared";
import { cn } from "@/lib/utils";

interface Props { chart: ChartData; reload: () => void }
interface FinChecks { signed: boolean; diagnosis: boolean; followUp: boolean; billing: boolean }

export function EncounterTab({ chart, reload }: Props) {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const role = useApp((s) => s.staff?.role ?? "");
  const encounters = chart.clinical?.encounters ?? [];
  const [encId, setEncId] = useState("");
  const [form, setForm] = useState({ chief: "", hpi: "", exam: "", assessment: "", plan: "", instructionsAr: "" });
  const [busy, setBusy] = useState(false);
  const [signOpen, setSignOpen] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);
  const [followUpDays, setFollowUpDays] = useState("30");
  const [checks, setChecks] = useState<FinChecks | null>(null);
  const canSign = SIGN_ROLES.has(role);
  const canWrite = canSign || role === "nurse"; // guardSign: SIGNERS ∪ nurse (dept-head/med-director read-only)

  const enc: EncounterRow | null = encounters.find((e) => e.id === encId) ?? null;

  // prefill SOAP fields on selection (no effect: selection is a user event)
  const prefill = (id: string) => {
    const e = encounters.find((x) => x.id === id);
    setForm({ chief: e?.chief ?? "", hpi: e?.hpi ?? "", exam: e?.exam ?? "", assessment: e?.assessment ?? "", plan: e?.plan ?? "", instructionsAr: e?.instructionsAr ?? "" });
  };
  const selectEnc = (id: string) => { setEncId(id); setChecks(null); prefill(id); };

  const createEnc = async () => {
    setBusy(true);
    try {
      const r = await apiPost<{ id: string; code: string }>("/api/staff/encounters/open", { patientId: chart.banner.id });
      toast({ title: t("emr.enc.created"), description: r.code });
      setEncId(r.id);
      setChecks(null);
      setForm({ chief: "", hpi: "", exam: "", assessment: "", plan: "", instructionsAr: "" });
      reload();
    } catch (e) {
      toast({ title: t("common.error"), description: errText(e, lang), variant: "destructive" });
    } finally { setBusy(false); }
  };

  const saveSoap = async () => {
    if (!enc) return;
    setBusy(true);
    try {
      await apiPost("/api/staff/encounters/soap", { encounterId: enc.id, ...form });
      toast({ title: t("emr.enc.saved") });
      reload();
    } catch (e) {
      toast({ title: t("common.error"), description: errText(e, lang), variant: "destructive" });
    } finally { setBusy(false); }
  };

  const sign = async () => {
    if (!enc) return;
    setBusy(true);
    try {
      await apiPost("/api/staff/encounters/sign", { encounterId: enc.id });
      toast({ title: t("emr.enc.signed"), description: enc.code });
      setSignOpen(false);
      reload();
    } catch (e) {
      const code = (e as { problem?: { code?: string } }).problem?.code;
      if (code === "STATE_INVALID") toast({ title: t("emr.enc.already"), description: enc.code });
      else toast({ title: t("common.error"), description: errText(e, lang), variant: "destructive" });
      setSignOpen(false);
      reload();
    } finally { setBusy(false); }
  };

  const finish = async () => {
    if (!enc) return;
    setBusy(true);
    try {
      const r = await apiPost<{ checks: FinChecks }>("/api/staff/encounters/finish-visit", { encounterId: enc.id, followUpDays: Number(followUpDays) || 0 });
      setChecks(r.checks);
      setFinishOpen(false);
      toast({ title: t("emr.enc.finished"), description: enc.code });
      reload();
    } catch (e) {
      toast({ title: t("common.error"), description: errText(e, lang), variant: "destructive" });
    } finally { setBusy(false); }
  };

  if (!chart.clinical) return <Empty label={t("emr.admin.note")} className="py-10" />;
  if (!canWrite) {
    return (
      <Section title={<><Stethoscope className="size-4 shrink-0" aria-hidden />{t("emr.soap.title")}</>}>
        <p className="text-sm text-muted-foreground p-2">{t("emr.enc.nowrite")}</p>
      </Section>
    );
  }

  const cl = { signed: !!enc?.signedAt, diagnosis: !!(enc?.assessment ?? "").trim(), followUp: Number(followUpDays) > 0, billing: true };
  const F = ({ k, rows = 3 }: { k: keyof typeof form; rows?: number }) => (
    <div className="grid gap-1">
      <Label className="text-xs text-muted-foreground">{t(`emr.soap.${k}`)}</Label>
      <Textarea value={form[k]} rows={rows} disabled={!enc || busy || !canWrite} onChange={(e) => setForm({ ...form, [k]: e.target.value })} className="text-sm" />
    </div>
  );

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="grid gap-1 min-w-56 flex-1">
          <Label className="text-xs text-muted-foreground">{t("emr.enc.pick")}</Label>
          <Select value={encId || undefined} onValueChange={selectEnc}>
            <SelectTrigger className="h-9 text-xs"><SelectValue placeholder={t("common.select")} /></SelectTrigger>
            <SelectContent>
              {encounters.map((e) => (
                <SelectItem key={e.id} value={e.id} className="text-xs">
                  <span className="font-mono">{e.code}</span> · {bhDateString(e.startedAt)} {e.signedAt ? t("status.signed") : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" className="h-9" disabled={busy} onClick={createEnc}><Plus className="size-4" aria-hidden />{t("emr.enc.new")}</Button>
        {canSign && enc && !enc.signedAt && <Button className="h-9 bg-teal-600 hover:bg-teal-700" disabled={busy} onClick={() => setSignOpen(true)}><FileSignature className="size-4" aria-hidden />{t("emr.enc.sign")}</Button>}
        {canSign && enc && <Button variant="secondary" className="h-9" disabled={busy} onClick={() => setFinishOpen(true)}><Flag className="size-4" aria-hidden />{t("emr.enc.finish")}</Button>}
        {enc && (
          <span className="flex items-center gap-1.5 ms-auto">
            <StatusBadge status={enc.signedAt ? "signed" : enc.status} />
            {enc.followUpAt && <Badge variant="outline" className="text-[10px]">{t("emr.enc.followup")}: {bhDateString(enc.followUpAt)}</Badge>}
          </span>
        )}
      </div>

      {checks && (
        <div className="rounded-lg border bg-card p-3 flex flex-wrap items-center gap-2 text-xs">
          <b>{t("emr.enc.checks")}:</b>
          {(Object.keys(cl) as (keyof FinChecks)[]).map((k) => (
            <Badge key={k} variant="outline" className={cn("border-transparent", checks[k] ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200" : "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200")}>
              {checks[k] ? <Check aria-hidden /> : "…"} {t(`emr.enc.chk.${k}`)}
            </Badge>
          ))}
        </div>
      )}

      <Section title={<><Stethoscope className="size-4 shrink-0" aria-hidden />{t("emr.soap.title")}</>}>
        <div className="grid gap-3 md:grid-cols-2">
          <F k="chief" rows={2} />
          <F k="hpi" rows={4} />
          <F k="exam" rows={4} />
          <F k="assessment" rows={4} />
          <F k="plan" rows={3} />
          <div className="grid gap-1 md:grid-cols-2 grid-cols-1 gap-3">
            <F k="instructionsAr" rows={3} />
            <div className="grid content-end gap-2">
              <p className="text-[11px] text-muted-foreground">{t("emr.soap.hint")}</p>
              <Button className="h-10" disabled={!enc || busy || !!enc?.signedAt} onClick={saveSoap}>
                {enc?.signedAt ? <span className="flex items-center gap-2"><Lock className="size-4" aria-hidden />{t("emr.enc.already")}</span> : busy ? t("common.loading") : t("common.save")}
              </Button>
            </div>
          </div>
        </div>
      </Section>

      <AlertDialog open={signOpen} onOpenChange={setSignOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("emr.enc.signConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("emr.enc.signConfirmBody", { code: enc?.code ?? "" })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={sign}><FileSignature className="size-4" aria-hidden />{t("common.sign")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={finishOpen} onOpenChange={setFinishOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2"><Flag className="size-4 shrink-0" aria-hidden />{t("emr.enc.finish")}</DialogTitle>
            <DialogDescription className="text-xs">{t("emr.enc.finishDesc")}</DialogDescription>
          </DialogHeader>
          <ul className="grid gap-1.5 text-sm">
            {(Object.keys(cl) as (keyof FinChecks)[]).map((k) => (
              <li key={k} className="flex items-center gap-2 rounded-md border p-2">
                <span className={cn("size-5 grid place-items-center rounded-full", cl[k] ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800")}>{cl[k] ? <Check className="size-3" aria-hidden /> : "!"}</span>
                {t(`emr.enc.chk.${k}`)}
              </li>
            ))}
          </ul>
          <div className="grid gap-1">
            <Label className="text-xs text-muted-foreground">{t("emr.enc.followupdays")}</Label>
            <Input type="number" min={0} max={365} value={followUpDays} onChange={(e) => setFollowUpDays(e.target.value)} className="h-9 font-mono w-28" dir="ltr" />
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setFinishOpen(false)}>{t("common.cancel")}</Button>
            <Button size="sm" disabled={busy} onClick={finish}>{t("emr.enc.finishGo")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
