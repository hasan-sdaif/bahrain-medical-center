"use client";
/**
 * emr-referral — الإحالة: to-dept select + urgency (طارئ ٢س / عاجل ٢٤س /
 * روتيني) + reason → SLA responseDueAt display.
 */
import { useState } from "react";
import { apiPost } from "@/lib/api-client";
import { useI18n, bi } from "@/i18n";
import { useToast } from "@/hooks/use-toast";
import { bhDateString, bhTimeString } from "@/lib/bahrain";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DEPARTMENTS, Section, errText, type ChartData } from "./emr-shared";

interface Props { chart: ChartData; reload: () => void }
const URGENCIES = [
  { k: "emergency", slaAr: "ساعتان", slaEn: "2h" },
  { k: "urgent", slaAr: "٢٤ ساعة", slaEn: "24h" },
  { k: "routine", slaAr: "روتيني", slaEn: "Routine" },
] as const;

export function ReferralTab({ chart }: Props) {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const [toDept, setToDept] = useState("");
  const [urgency, setUrgency] = useState<(typeof URGENCIES)[number]["k"]>("routine");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ code: string; responseDueAt: string | null } | null>(null);

  const submit = async () => {
    setBusy(true);
    try {
      const r = await apiPost<{ code: string; responseDueAt: string | null }>("/api/staff/referrals", {
        patientId: chart.banner.id, toDept, urgency, reason: reason.trim() || undefined,
      });
      setResult(r);
      setReason("");
      toast({ title: t("emr.ref.ok", { code: r.code }), description: r.responseDueAt ? `${t("emr.ref.due")}: ${bhDateString(r.responseDueAt)} ${bhTimeString(r.responseDueAt)}` : undefined });
    } catch (e) {
      toast({ title: t("common.error"), description: errText(e, lang), variant: "destructive" });
    } finally { setBusy(false); }
  };

  return (
    <div className="grid gap-3 max-w-3xl">
      <Section title={`↗ ${t("emr.tab.referral")}`}>
        <div className="grid gap-3">
          <div className="grid gap-1">
            <Label className="text-xs text-muted-foreground">{t("emr.ref.todept")}</Label>
            <Select value={toDept || undefined} onValueChange={setToDept}>
              <SelectTrigger className="h-10 text-sm"><SelectValue placeholder={t("common.select")} /></SelectTrigger>
              <SelectContent>
                {DEPARTMENTS.map((d) => (
                  <SelectItem key={d.code} value={d.code} className="text-sm">{bi(lang, d.ar, d.en)} <span className="font-mono text-[10px] text-muted-foreground">{d.code}</span></SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1">
            <Label className="text-xs text-muted-foreground">{t("emr.ref.urgency")}</Label>
            <RadioGroup value={urgency} onValueChange={(v) => setUrgency(v as typeof urgency)} className="flex flex-wrap gap-3">
              {URGENCIES.map((u) => (
                <label key={u.k} className="flex items-center gap-1.5 text-sm cursor-pointer rounded-lg border px-3 h-10 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                  <RadioGroupItem value={u.k} id={`urg-${u.k}`} />
                  <span className="font-medium">{t(`priority.${u.k}`)}</span>
                  <Badge variant="outline" className="text-[10px]">{bi(lang, u.slaAr, u.slaEn)}</Badge>
                </label>
              ))}
            </RadioGroup>
          </div>

          <div className="grid gap-1">
            <Label htmlFor="ref-reason" className="text-xs text-muted-foreground">{t("common.reason")}</Label>
            <Input id="ref-reason" value={reason} onChange={(e) => setReason(e.target.value)} className="h-10 text-sm" placeholder={t("emr.ref.reasonHint")} />
          </div>

          <Button className="h-10 self-start px-6" disabled={!toDept || busy} onClick={submit}>{busy ? t("common.loading") : t("emr.ref.send")}</Button>
        </div>
      </Section>

      {result && (
        <div className="rounded-xl border-2 border-teal-500 bg-teal-50 dark:bg-teal-950/40 p-4 flex flex-wrap items-center gap-3">
          <Badge className="bg-teal-600 border-transparent text-white text-sm font-mono">✓ {result.code}</Badge>
          {result.responseDueAt && (
            <span className="text-sm">
              ⏱️ {t("emr.ref.due")}: <b className="font-mono">{bhDateString(result.responseDueAt)} · {bhTimeString(result.responseDueAt)}</b>
              <span className="text-xs text-muted-foreground block">{t("emr.ref.slaNote")}</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
