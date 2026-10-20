"use client";
/** Fault-report dialog + success banner (auto work-order outcome). */
import { useState, type FormEvent } from "react";
import { useI18n } from "@/i18n";
import { apiPost } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Camera } from "lucide-react";
import { errText, fmtDT, type AssetRow, type FaultResp } from "./ops-shared";

const IMPACTS = ["full", "partial", "none"] as const;
const CATEGORIES = ["mechanical", "electrical", "software", "other"] as const;

export function FaultSuccess({ fr }: { fr: FaultResp }) {
  const { t } = useI18n();
  return (
    <Alert className="border-teal-600/40 bg-teal-50 dark:bg-teal-950/40">
      <AlertTitle className="text-sm font-semibold">{t("ops.fault.success.title")}</AlertTitle>
      <AlertDescription className="space-y-1 text-xs">
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <span>{t("ops.fault.fr")}: <span className="font-mono font-semibold">{fr.code}</span></span>
          <span>{t("ops.fault.wo")}: <span className="font-mono font-semibold">{fr.workOrder.code}</span></span>
        </div>
        <div>{t("ops.fault.sla")}: <span className="font-mono">{fmtDT(fr.workOrder.slaDueAt)}</span></div>
        <div className="font-medium text-foreground">{t("ops.fault.success.body")}</div>
      </AlertDescription>
    </Alert>
  );
}

export function FaultDialog({ asset, open, onOpenChange, onDone }: {
  asset: AssetRow; open: boolean; onOpenChange: (o: boolean) => void; onDone: (fr: FaultResp) => void;
}) {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const [desc, setDesc] = useState("");
  const [impact, setImpact] = useState<string>("partial");
  const [category, setCategory] = useState<string>("mechanical");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || !desc.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await apiPost<FaultResp>("/api/staff/maintenance/report-fault", {
        assetCode: asset.code, description: desc.trim(), impact, category, photos: [],
      });
      onDone(res);
      onOpenChange(false);
      setDesc("");
      toast({ title: t("ops.fault.success.title"), description: `${res.code} → ${res.workOrder.code}` });
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
          <DialogTitle>{t("ops.fault.title")}</DialogTitle>
          <DialogDescription className="font-mono text-xs">{asset.code} — {asset.nameAr}</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <div className="space-y-1.5">
            <Label htmlFor="fault-desc">{t("ops.fault.desc")}</Label>
            <Textarea id="fault-desc" value={desc} onChange={(e) => setDesc(e.target.value)} required
              placeholder={t("ops.fault.desc.ph")} className="min-h-24 text-sm" />
          </div>
          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium">{t("ops.fault.impact")}</legend>
            <RadioGroup value={impact} onValueChange={setImpact} className="grid gap-2 sm:grid-cols-3">
              {IMPACTS.map((im) => (
                <label key={im} htmlFor={`imp-${im}`} className="flex h-11 items-center gap-2 rounded-lg border px-3 text-sm has-[[data-state=checked]]:border-primary">
                  <RadioGroupItem id={`imp-${im}`} value={im} />
                  {t(`ops.fault.impact.${im}`)}
                </label>
              ))}
            </RadioGroup>
          </fieldset>
          <div className="space-y-1.5">
            <Label htmlFor="fault-cat">{t("ops.fault.category")}</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="fault-cat" className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{t(`ops.fault.cat.${c}`)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Camera className="size-3.5 shrink-0" aria-hidden />{t("ops.fault.photos")}</p>
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
