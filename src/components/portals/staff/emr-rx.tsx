"use client";
/**
 * emr-rx — الوصفات: drug rows builder → §17.7 safety checks. Blocked (red)
 * requires override reason + resubmit; warnings amber; dose helpers cards.
 */
import { useState } from "react";
import { apiPost } from "@/lib/api-client";
import { useI18n, bi } from "@/i18n";
import { useToast } from "@/hooks/use-toast";
import { useApp } from "@/store/app";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DRUG_CATALOG, RX_ROLES, Section, errText, type ChartData } from "./emr-shared";

interface Props { chart: ChartData; reload: () => void }
interface RxItem { drugCode: string; doseMg: string; frequency: string; durationDays: string; qty: string }
interface RxMsg { code: string; ar: string; en: string }
interface RxResp { code: string; blocked: boolean; errors: RxMsg[]; warnings: RxMsg[]; doseHelpers: { drugCode: string; dailyMg?: number; perDoseMg?: number; volumeMl?: number | null }[] }

const DRUGS = DRUG_CATALOG.filter((d) => d.code !== "INS-R");
const FREQ = ["مرة يومياً", "مرتين يومياً", "٣ مرات يومياً", "٤ مرات يومياً", "كل ٨ ساعات", "كل ١٢ ساعة", "عند اللزوم"];
const emptyRow = (): RxItem => ({ drugCode: "PARA", doseMg: "500", frequency: FREQ[1], durationDays: "5", qty: "20" });

export function RxTab({ chart }: Props) {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const role = useApp((s) => s.staff?.role ?? "");
  const [rows, setRows] = useState<RxItem[]>([emptyRow()]);
  const [busy, setBusy] = useState(false);
  const [resp, setResp] = useState<RxResp | null>(null);
  const [override, setOverride] = useState("");
  const canRx = RX_ROLES.has(role);

  const upd = (i: number, k: keyof RxItem, v: string) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [k]: v } : r)));

  const submit = async (withOverride = false) => {
    setBusy(true);
    try {
      const items = rows
        .filter((r) => r.drugCode && Number(r.doseMg) > 0)
        .map((r) => ({
          drugCode: r.drugCode, doseMg: Number(r.doseMg), doseAr: `${r.doseMg} mg`,
          frequency: r.frequency, durationDays: Number(r.durationDays) || 1, qty: Number(r.qty) || 1,
        }));
      const r = await apiPost<RxResp>("/api/staff/prescriptions", {
        patientId: chart.banner.id, items, overrideReason: withOverride ? override.trim() || undefined : undefined,
      });
      setResp(r);
      setOverride("");
      toast({
        title: r.blocked ? t("emr.rx.blocked", { code: r.code }) : t("emr.rx.ok", { code: r.code }),
        description: `${r.errors.length} ⛔ · ${r.warnings.length} ⚠️`,
        variant: r.blocked ? "destructive" : undefined,
      });
    } catch (e) {
      toast({ title: t("common.error"), description: errText(e, lang), variant: "destructive" });
    } finally { setBusy(false); }
  };

  if (!canRx) return <Section title={`💊 ${t("emr.tab.rx")}`}><p className="text-sm text-muted-foreground p-2">{t("emr.rx.norole")}</p></Section>;

  return (
    <div className="grid gap-3">
      <Section title={`💊 ${t("emr.rx.title")}`} actions={<Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => setRows((rs) => [...rs, emptyRow()])}>＋ {t("emr.rx.addrow")}</Button>}>
        <div className="grid gap-2">
          {rows.map((r, i) => (
            <div key={i} className="grid grid-cols-2 md:grid-cols-12 gap-2 items-end rounded-md border p-2">
              <div className="grid gap-1 col-span-2 md:col-span-4">
                <Label className="text-[11px] text-muted-foreground">{t("emr.rx.drug")}</Label>
                <Select value={r.drugCode} onValueChange={(v) => upd(i, "drugCode", v)}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DRUGS.map((d) => (
                      <SelectItem key={d.code} value={d.code} className="text-xs">
                        {bi(lang, d.ar, d.en)} <span className="font-mono text-[10px] text-muted-foreground">{d.code} · {d.strength}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1 md:col-span-2">
                <Label className="text-[11px] text-muted-foreground">{t("emr.rx.dose")}</Label>
                <Input type="number" min={0} value={r.doseMg} onChange={(e) => upd(i, "doseMg", e.target.value)} className="h-9 font-mono" dir="ltr" aria-label={t("emr.rx.dose")} />
              </div>
              <div className="grid gap-1 md:col-span-2">
                <Label className="text-[11px] text-muted-foreground">{t("emr.rx.freq")}</Label>
                <Select value={r.frequency} onValueChange={(v) => upd(i, "frequency", v)}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{FREQ.map((f) => <SelectItem key={f} value={f} className="text-xs">{f}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-1 md:col-span-1">
                <Label className="text-[11px] text-muted-foreground">{t("emr.rx.days")}</Label>
                <Input type="number" min={1} value={r.durationDays} onChange={(e) => upd(i, "durationDays", e.target.value)} className="h-9 font-mono" dir="ltr" aria-label={t("emr.rx.days")} />
              </div>
              <div className="grid gap-1 md:col-span-1">
                <Label className="text-[11px] text-muted-foreground">{t("common.quantity")}</Label>
                <Input type="number" min={1} value={r.qty} onChange={(e) => upd(i, "qty", e.target.value)} className="h-9 font-mono" dir="ltr" aria-label={t("common.quantity")} />
              </div>
              <Button variant="ghost" size="sm" className="h-9 text-rose-600 md:col-span-1" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))} disabled={rows.length === 1} aria-label={t("common.remove")}>✕</Button>
            </div>
          ))}
          <Button className="h-10 self-start px-6" disabled={busy} onClick={() => submit(false)}>{busy ? t("common.loading") : t("emr.rx.check")}</Button>
        </div>
      </Section>

      {resp && (
        <Section title={`🛡️ ${t("emr.rx.report")}`} actions={<Badge variant="outline" className="font-mono text-[10px]">{resp.code}</Badge>}>
          <div className="grid gap-2">
            {resp.blocked && (
              <div role="alert" className="rounded-lg border-2 border-red-400 bg-red-50 dark:bg-red-950/40 p-3 grid gap-2">
                <b className="text-sm text-red-900 dark:text-red-200">⛔ {t("emr.rx.blockedTitle")}</b>
                <ul className="grid gap-1 text-xs text-red-800 dark:text-red-300">
                  {resp.errors.map((m) => <li key={m.code} className="font-mono">· {bi(lang, m.ar, m.en)} <span className="opacity-60">[{m.code}]</span></li>)}
                </ul>
                <div className="grid gap-1">
                  <Label className="text-xs text-muted-foreground">{t("emr.rx.override")}</Label>
                  <Textarea value={override} onChange={(e) => setOverride(e.target.value)} rows={2} className="text-sm" placeholder={t("emr.rx.overrideHint")} />
                </div>
                <Button variant="destructive" className="h-9 self-start" disabled={busy || !override.trim()} onClick={() => submit(true)}>{t("emr.rx.overrideGo")}</Button>
              </div>
            )}
            {!resp.blocked && <div className="rounded-md border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 p-2.5 text-sm text-emerald-900 dark:text-emerald-200">✓ {t("emr.rx.ok", { code: resp.code })}</div>}
            {resp.warnings.map((w) => (
              <div key={w.code} className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/40 p-2 text-xs text-amber-900 dark:text-amber-200">⚠️ {bi(lang, w.ar, w.en)}</div>
            ))}
            {resp.doseHelpers.length > 0 && (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {resp.doseHelpers.map((h) => (
                  <div key={h.drugCode} className="rounded-md border p-2.5 text-xs grid gap-1">
                    <b className="font-mono">{h.drugCode} · {t("emr.rx.helper")}</b>
                    <span>{t("emr.rx.daily")}: <b className="font-mono">{h.dailyMg} mg</b></span>
                    <span>{t("emr.rx.perdose")}: <b className="font-mono">{h.perDoseMg} mg</b></span>
                    {h.volumeMl != null && <span>{t("emr.rx.volume")}: <b className="font-mono">{h.volumeMl} ml</b></span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </Section>
      )}
    </div>
  );
}
