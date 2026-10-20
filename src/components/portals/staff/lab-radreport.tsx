"use client";
/**
 * تقرير الأشعة — report dialog with template switching (TI-RADS: size/margins +
 * TR1-5 select; BI-RADS: B0-B6 select; عام/بطن/مسالك: textareas only), bilingual
 * impression + e-sign checkbox, and a DICOM/PACS speckle-noise image placeholder.
 */
import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n";
import { apiPost } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { errText, type StudyRow } from "./lab-shared";

const TEMPLATES = ["general", "abdomen", "renal", "tirads", "birads"] as const;
const TR_LEVELS = ["TR1", "TR2", "TR3", "TR4", "TR5"];
const BIR_LEVELS = ["B0", "B1", "B2", "B3", "B4", "B5", "B6"];

/** Grayscale speckle-noise placeholder — deterministic per study seed. */
function SpeckleImage({ seed }: { seed: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const { t } = useI18n();
  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    let s = 7;
    for (const ch of seed) s = (s * 31 + ch.charCodeAt(0)) % 9973;
    const rnd = () => { s = (s * 137 + 7919) % 99991; return s / 99991; };
    ctx.fillStyle = "#0b0b0d";
    ctx.fillRect(0, 0, c.width, c.height);
    for (let i = 0; i < 1100; i++) {
      const g = Math.floor(rnd() * 92);
      ctx.fillStyle = `rgba(${g},${g},${g},${0.2 + rnd() * 0.5})`;
      ctx.fillRect(Math.floor(rnd() * c.width), Math.floor(rnd() * c.height), 2 + Math.floor(rnd() * 6), 2 + Math.floor(rnd() * 6));
    }
    for (let i = 0; i < 6; i++) {
      const g = 120 + Math.floor(rnd() * 110);
      ctx.fillStyle = `rgba(${g},${g},${g},0.16)`;
      ctx.beginPath();
      ctx.arc(rnd() * c.width, rnd() * c.height, 16 + rnd() * 40, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [seed]);
  return (
    <figure className="grid gap-1.5 justify-items-center">
      <canvas ref={ref} width={288} height={216} role="img" aria-label={t("lab.rad.image")} className="rounded-lg border w-full max-w-72" />
      <figcaption className="text-[10px] text-muted-foreground font-mono">🖼 {t("lab.rad.image")}</figcaption>
    </figure>
  );
}

export function ReportDialog({ study, open, onClose, onDone }: { study: StudyRow; open: boolean; onClose: () => void; onDone: () => void }) {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const [template, setTemplate] = useState<string>(TEMPLATES.includes((study.template ?? "") as (typeof TEMPLATES)[number]) ? study.template! : "general");
  const [size, setSize] = useState("");
  const [margins, setMargins] = useState("");
  const [tr, setTr] = useState<string>("");
  const [birads, setBirads] = useState<string>("");
  const [findingsAr, setFindingsAr] = useState(study.findingsAr ?? "");
  const [reportAr, setReportAr] = useState(study.reportAr ?? "");
  const [reportEn, setReportEn] = useState(study.reportEn ?? "");
  const [sign, setSign] = useState(false);
  const [busy, setBusy] = useState(false);

  const phKey = template === "tirads" ? "lab.rad.findings.ph.tirads" : template === "birads" ? "lab.rad.findings.ph.birads" : "lab.rad.findings.ph.general";
  const grade = template === "tirads" && tr ? `TI-RADS ${tr}` : template === "birads" && birads ? `BI-RADS ${birads}` : null;

  const submit = async () => {
    setBusy(true);
    try {
      await apiPost("/api/staff/radiology/report", {
        studyId: study.id,
        reportAr: reportAr.trim() || undefined,
        reportEn: reportEn.trim() || undefined,
        findingsAr: findingsAr.trim() || undefined,
        grade: grade ?? undefined,
        template,
        sign,
      });
      toast({ title: `✅ ${t("lab.rad.reportOk")}`, description: sign ? `${t("common.sign")}: ${study.code}` : study.code });
      onDone();
      onClose();
    } catch (e) {
      toast({ title: t("common.error"), description: errText(e, lang), variant: "destructive" });
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("lab.rad.report")} — <span className="font-mono">{study.code}</span></DialogTitle>
          <DialogDescription>{study.patient.nameAr} · MRN {study.patient.mrn}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-start">
          <div className="grid gap-3">
            <div className="grid gap-1.5 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label>{t("lab.rad.template")}</Label>
                <Select value={template} onValueChange={setTemplate}>
                  <SelectTrigger className="h-10 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TEMPLATES.map((tp) => <SelectItem key={tp} value={tp} className="text-xs">{t(`lab.rad.tpl.${tp}`)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {template === "tirads" && (
                <div className="grid gap-1.5">
                  <Label>{t("lab.rad.tr")}</Label>
                  <Select value={tr} onValueChange={setTr}>
                    <SelectTrigger className="h-10 text-xs font-mono"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TR_LEVELS.map((v) => <SelectItem key={v} value={v} className="text-xs font-mono">{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {template === "birads" && (
                <div className="grid gap-1.5">
                  <Label>{t("lab.rad.birads")}</Label>
                  <Select value={birads} onValueChange={setBirads}>
                    <SelectTrigger className="h-10 text-xs font-mono"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {BIR_LEVELS.map((v) => <SelectItem key={v} value={v} className="text-xs font-mono">{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            {template === "tirads" && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="lb-size">{t("lab.rad.size")}</Label>
                  <Input id="lb-size" type="number" step="0.1" inputMode="decimal" value={size} onChange={(e) => setSize(e.target.value)} className="h-10 font-mono" placeholder="1.8" />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="lb-marg">{t("lab.rad.margins")}</Label>
                  <Input id="lb-marg" value={margins} onChange={(e) => setMargins(e.target.value)} className="h-10" placeholder="well-defined / حدوث واضحة" />
                </div>
              </div>
            )}
            <div className="grid gap-1.5">
              <Label htmlFor="lb-find">{t("lab.rad.findings")}</Label>
              <Textarea id="lb-find" value={findingsAr} onChange={(e) => setFindingsAr(e.target.value)} placeholder={t(phKey)} className="min-h-20 text-xs" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="lb-rar">{t("lab.rad.reportAr")}</Label>
              <Textarea id="lb-rar" value={reportAr} onChange={(e) => setReportAr(e.target.value)} className="min-h-16 text-xs" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="lb-ren">{t("lab.rad.reportEn")}</Label>
              <Textarea id="lb-ren" value={reportEn} onChange={(e) => setReportEn(e.target.value)} dir="ltr" className="min-h-16 text-xs" />
            </div>
            <Label className="flex items-start gap-2.5 font-normal cursor-pointer rounded-lg border p-3 text-sm">
              <Checkbox checked={sign} onCheckedChange={(v) => setSign(v === true)} className="mt-0.5" />
              <span>✍️ {t("lab.rad.sign")}</span>
            </Label>
          </div>
          <SpeckleImage seed={study.images[0]?.seed ?? study.code} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
          <Button disabled={busy} onClick={submit}>{busy ? "…" : sign ? t("common.sign") : t("common.save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
