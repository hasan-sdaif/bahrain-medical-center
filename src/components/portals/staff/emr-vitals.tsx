"use client";
/**
 * emr-vitals — المؤشرات: triage vitals form (temp/pulse/resp/BP/SpO₂/weight/
 * height/waist) → server-computed BMI + history table (last records).
 */
import { useState } from "react";
import { apiPost } from "@/lib/api-client";
import { useI18n } from "@/i18n";
import { useToast } from "@/hooks/use-toast";
import { useApp } from "@/store/app";
import { bhDateString, bhTimeString } from "@/lib/bahrain";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChartLine, History } from "lucide-react";
import { Empty, Section, errText, type ChartData } from "./emr-shared";

interface Props { chart: ChartData; reload: () => void }

type FieldKey = "tempC" | "pulse" | "resp" | "bpSys" | "bpDia" | "spo2" | "weightKg" | "heightCm" | "waistCm";
const FIELDS: { k: FieldKey; ar: string; en: string; step?: string }[] = [
  { k: "tempC", ar: "الحرارة °م", en: "Temp °C", step: "0.1" },
  { k: "pulse", ar: "النبض", en: "Pulse" },
  { k: "resp", ar: "التنفس", en: "Resp" },
  { k: "bpSys", ar: "الانقباضي", en: "Systolic" },
  { k: "bpDia", ar: "الانبساطي", en: "Diastolic" },
  { k: "spo2", ar: "الأكسجين %", en: "SpO₂ %" },
  { k: "weightKg", ar: "الوزن كغ", en: "Weight kg", step: "0.1" },
  { k: "heightCm", ar: "الطول سم", en: "Height cm", step: "0.1" },
  { k: "waistCm", ar: "محيط الخصر سم", en: "Waist cm", step: "0.1" },
];

export function VitalsTab({ chart, reload }: Props) {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const role = useApp((s) => s.staff?.role ?? "");
  const canTriage = role === "nurse"; // "triage" module in RBAC matrix
  const [vals, setVals] = useState<Record<FieldKey, string>>({ tempC: "", pulse: "", resp: "", bpSys: "", bpDia: "", spo2: "", weightKg: "", heightCm: "", waistCm: "" });
  const [busy, setBusy] = useState(false);
  const [bmi, setBmi] = useState<number | null>(null);
  const history = chart.clinical?.vitals ?? [];

  const submit = async () => {
    setBusy(true);
    try {
      const body: Record<string, number | string> = { patientId: chart.banner.id };
      for (const f of FIELDS) if (vals[f.k].trim()) body[f.k] = Number(vals[f.k]);
      const r = await apiPost<{ bmi: number | null }>("/api/staff/vitals", body);
      setBmi(r.bmi);
      toast({ title: t("emr.vit.ok"), description: r.bmi != null ? `BMI ${r.bmi}` : undefined });
      setVals({ tempC: "", pulse: "", resp: "", bpSys: "", bpDia: "", spo2: "", weightKg: "", heightCm: "", waistCm: "" });
      reload();
    } catch (e) {
      toast({ title: t("common.error"), description: errText(e, lang), variant: "destructive" });
    } finally { setBusy(false); }
  };

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {canTriage ? (
      <Section title={<><ChartLine className="size-4 shrink-0" aria-hidden />{t("emr.tab.vitals")}</>}>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {FIELDS.map((f) => (
            <div key={f.k} className="grid gap-1">
              <Label htmlFor={`vit-${f.k}`} className="text-xs text-muted-foreground">{lang === "ar" ? f.ar : f.en}</Label>
              <Input
                id={`vit-${f.k}`} type="number" inputMode="decimal" step={f.step} min="0" dir="ltr"
                value={vals[f.k]} onChange={(e) => setVals((v) => ({ ...v, [f.k]: e.target.value }))}
                className="h-10 font-mono" placeholder="—" />
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3 mt-3">
          <Button className="h-10 px-6" disabled={busy || !Object.values(vals).some((v) => v.trim())} onClick={submit}>{busy ? t("common.loading") : t("emr.vit.save")}</Button>
          {bmi != null && <Badge className="bg-teal-600 border-transparent text-white">BMI: <b className="font-mono ms-1">{bmi}</b></Badge>}
        </div>
      </Section>
      ) : (
        <Section title={<><ChartLine className="size-4 shrink-0" aria-hidden />{t("emr.tab.vitals")}</>}>
          <p className="text-sm text-muted-foreground p-2">{t("emr.vit.norole")}</p>
        </Section>
      )}

      <Section title={<><History className="size-4 shrink-0" aria-hidden />{t("emr.vit.history")}</>}>
        {history.length === 0 ? <Empty label={t("emr.none.vitals")} className="py-4" /> : (
          <div className="rounded-md border overflow-x-auto max-h-96 overflow-y-auto bmc-scroll">
            <Table className="text-xs">
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="h-8">{t("common.date")}</TableHead>
                  <TableHead className="h-8">BP</TableHead>
                  <TableHead className="h-8">{t("emr.vitals.pulse")}</TableHead>
                  <TableHead className="h-8">T°C</TableHead>
                  <TableHead className="h-8">SpO₂</TableHead>
                  <TableHead className="h-8">{t("emr.vit.wt")}</TableHead>
                  <TableHead className="h-8">BMI</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((v) => (
                  <TableRow key={v.id} className="[&>td]:py-1 [&>td]:px-2">
                    <TableCell className="whitespace-nowrap font-mono tabular-nums">{bhDateString(v.recordedAt)} <span className="text-muted-foreground">{bhTimeString(v.recordedAt)}</span></TableCell>
                    <TableCell className="font-mono" dir="ltr">{v.bpSys && v.bpDia ? `${v.bpSys}/${v.bpDia}` : "—"}</TableCell>
                    <TableCell className="font-mono">{v.pulse ?? "—"}</TableCell>
                    <TableCell className="font-mono">{v.tempC ?? "—"}</TableCell>
                    <TableCell className="font-mono">{v.spo2 ? `${v.spo2}%` : "—"}</TableCell>
                    <TableCell className="font-mono">{v.weightKg ?? "—"}</TableCell>
                    <TableCell className="font-mono font-bold">{v.bmi ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Section>
    </div>
  );
}
