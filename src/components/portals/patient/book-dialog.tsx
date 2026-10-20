"use client";
/**
 * New appointment booking — dept → visit type → day → slot flow
 * (/api/public/slots), then POST /api/patient/appointments/book with conflict
 * (SLOT_TAKEN / PATIENT_DOUBLE_BOOKED) surfacing. Success shows the barcode.
 */
import { useEffect, useMemo, useState } from "react";
import { useI18n, bi } from "@/i18n";
import { apiGet, apiPost } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import { MoneyText } from "@/components/shared/badges";
import { bhDateString, bhTimeString } from "@/lib/bahrain";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { BarcodeBlock } from "./parts";
import { errText, useFetch, type CatalogPayload, type SlotRow } from "./lib";
import { CheckCircle2, Loader2, UtensilsCrossed, Video } from "lucide-react";

const DAYS = [0, 1, 2, 3, 4, 5, 6];

export default function BookDialog({ open, onOpenChange, onBooked }: { open: boolean; onOpenChange: (o: boolean) => void; onBooked: () => void }) {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const catalog = useFetch<CatalogPayload>(() => apiGet<CatalogPayload>("/api/public/catalog"), [open]);
  const [step, setStep] = useState(0);
  const [dept, setDept] = useState<string | null>(null);
  const [typeCode, setTypeCode] = useState<string | null>(null);
  const [day, setDay] = useState(0);
  const [slot, setSlot] = useState<SlotRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ code: string; barcode: string } | null>(null);

  useEffect(() => { if (open) { setStep(0); setDept(null); setTypeCode(null); setDay(0); setSlot(null); setDone(null); } }, [open]);

  const services = useMemo(() => (catalog.data?.services ?? []).filter((s) => s.deptCode === dept), [catalog.data, dept]);
  const type = services.find((s) => s.code === typeCode) ?? null;
  const slots = useFetch<{ slots: SlotRow[] }>(
    () => (open && step === 3 ? apiGet<{ slots: SlotRow[] }>(`/api/public/slots?dept=${dept}&day=${day}`) : Promise.resolve({ slots: [] })),
    [open, step, dept, day],
  );

  const submit = async () => {
    if (!slot || !typeCode) return;
    setBusy(true);
    try {
      const r = await apiPost<{ code: string; barcode: string }>("/api/patient/appointments/book", {
        start: slot.at, typeCode, deptCode: dept ?? undefined, doctorId: slot.doctorId,
      });
      setDone(r);
      onBooked();
    } catch (e) {
      toast({ title: t("common.error"), description: errText(e, lang), variant: "destructive" });
      slots.reload();
    } finally { setBusy(false); }
  };

  const byDoctor = useMemo(() => {
    const m = new Map<string, SlotRow[]>();
    for (const s of slots.data?.slots ?? []) {
      const k = s.doctorId;
      m.set(k, [...(m.get(k) ?? []), s]);
    }
    return [...m.entries()];
  }, [slots.data]);

  const dayLabel = (d: number) => {
    const date = new Date(Date.now() + d * 86400000);
    const wd = new Intl.DateTimeFormat(lang === "ar" ? "ar" : "en-GB", { weekday: "short" }).format(date);
    return d === 0 ? `${t("pp.book.today")}` : d === 1 ? `${t("pp.book.tomorrow")}` : `${wd} ${date.getDate()}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{done ? t("pp.book.done") : t("pp.book.title")}</DialogTitle>
        </DialogHeader>
        {!done ? <Progress value={((step + 1) / 4) * 100} className="h-1.5" aria-label={`${step + 1}/4`} /> : null}

        {done ? (
          <div className="grid gap-3 text-center">
            <CheckCircle2 className="mx-auto size-12 text-emerald-600" aria-hidden />
            <p className="font-mono text-lg font-bold" dir="ltr">{done.code}</p>
            <BarcodeBlock value={done.barcode} hint={t("pp.appt.barcodeHint")} />
            <Button className="min-h-11" onClick={() => onOpenChange(false)}>{t("common.close")}</Button>
          </div>
        ) : catalog.loading ? (
          <div className="grid gap-2" aria-busy="true">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>
        ) : catalog.error ? (
          <p className="text-sm text-destructive">{catalog.error}</p>
        ) : step === 0 ? (
          <div className="grid grid-cols-2 gap-2">
            {(catalog.data?.departments ?? []).map((d) => (
              <Button key={d.code} variant="outline" className="min-h-11 justify-start text-start" onClick={() => { setDept(d.code); setTypeCode(null); setStep(1); }}>
                {bi(lang, d.nameAr, d.nameEn)}
              </Button>
            ))}
          </div>
        ) : step === 1 ? (
          <div className="grid gap-2">
            {services.length ? services.map((s) => (
              <Button key={s.code} variant="outline" className="flex h-auto min-h-11 flex-col items-start gap-1 py-2.5 text-start" onClick={() => { setTypeCode(s.code); setStep(2); }}>
                <span className="flex w-full items-center justify-between gap-2">
                  <span className="font-medium">{bi(lang, s.nameAr, s.nameEn)}</span>
                  <MoneyText fils={s.priceFils} className="text-xs" />
                </span>
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  {t("pp.book.min", { n: s.durationMin })}
                  {s.fasting ? <Badge variant="outline" className="h-5 border-transparent bg-amber-100 px-1.5 text-[10px] text-amber-900 dark:bg-amber-950 dark:text-amber-200"><UtensilsCrossed className="me-0.5 size-3" aria-hidden />{t("pp.hd.fastingTest")}</Badge> : null}
                  {s.isVideo ? <Badge variant="secondary" className="h-5 gap-1 px-1.5 text-[10px]"><Video className="size-3" aria-hidden />{t("pp.book.video")}</Badge> : null}
                </span>
              </Button>
            )) : <p className="text-sm text-muted-foreground">{t("common.empty")}</p>}
          </div>
        ) : step === 2 ? (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {DAYS.map((d) => (
              <Button key={d} variant={day === d ? "default" : "outline"} className="min-h-11" onClick={() => { setDay(d); setSlot(null); setStep(3); }}>{dayLabel(d)}</Button>
            ))}
          </div>
        ) : (
          <div className="grid gap-3">
            {slots.loading ? <div className="grid gap-2" aria-busy="true">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-11 rounded-lg" />)}</div>
              : byDoctor.length ? byDoctor.map(([docId, ss]) => (
                <div key={docId}>
                  <p className="mb-1.5 text-xs font-semibold text-muted-foreground">{bi(lang, ss[0].doctorAr, ss[0].doctorEn)}</p>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {ss.map((s) => (
                      <Button key={s.at} variant={slot?.at === s.at ? "default" : "outline"} size="sm" className="min-h-11 font-mono" dir="ltr" onClick={() => setSlot(s)}>{bhTimeString(s.at)}</Button>
                    ))}
                  </div>
                </div>
              )) : <p className="py-4 text-center text-sm text-muted-foreground">{t("pp.book.slotsEmpty")}</p>}
            {slots.error ? <p className="text-sm text-destructive">{slots.error}</p> : null}
            <div className="flex items-center gap-2">
              <Button variant="ghost" className="min-h-11" onClick={() => setStep(2)}>{t("common.back")}</Button>
              <Button className="min-h-11 flex-1" disabled={!slot || busy} onClick={submit}>
                {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                {t("pp.book.confirm")}{slot ? ` — ${bhDateString(slot.at)} ${bhTimeString(slot.at)}` : ""}
              </Button>
            </div>
            {type ? <p className="text-center text-xs text-muted-foreground">{bi(lang, type.nameAr, type.nameEn)} · <MoneyText fils={type.priceFils} currency={false} /></p> : null}
          </div>
        )}
        {!done && step > 0 && step < 3 ? <Button variant="ghost" size="sm" className={cn("min-h-11")} onClick={() => setStep(step - 1)}>{t("common.back")}</Button> : null}
      </DialogContent>
    </Dialog>
  );
}
