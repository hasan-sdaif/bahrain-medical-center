"use client";
/** Guest booking — zustand trigger + multi-step dialog shell + CTA section.
 *  Step bodies live in booking-steps.tsx (choose) and booking-final.tsx (confirm). */
import { useState } from "react";
import { create } from "zustand";
import { CalendarPlus, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import { Section } from "../section-shell";
import { DeptStep, DoctorStep, SlotStep } from "./booking-steps";
import { DetailsStep, OtpStep, SuccessStep } from "./booking-final";

export interface BookingPrefill { deptCode?: string; doctorId?: string }
export interface SlotDto { doctorId: string; doctorAr: string; doctorEn: string; at: string; priceFils: number }
export interface BookingRequestRes { id: string; code: string; otpDemo: string; noteAr: string; noteEn?: string | null }
export interface BookingVerifyRes { appointment: { code: string; start: string }; patient: { mrn: string; nameAr: string }; noteAr: string; noteEn?: string | null }

interface BookingStore {
  open: boolean; seq: number; prefill: BookingPrefill;
  openBooking: (p?: BookingPrefill) => void; closeBooking: () => void;
}
export const useBooking = create<BookingStore>()((set) => ({
  open: false, seq: 0, prefill: {},
  openBooking: (p = {}) => set((s) => ({ open: true, prefill: p, seq: s.seq + 1 })),
  closeBooking: () => set({ open: false, prefill: {} }),
}));

const STEP_KEYS = ["public.booking.step.dept", "public.booking.step.doctor", "public.booking.step.slot", "public.booking.step.details"];

function Stepper({ step }: { step: number }) {
  const { t } = useI18n();
  return (
    <div className="flex items-center justify-center gap-1.5 flex-wrap" aria-label={t("public.booking.step.of", { n: step + 1, m: 4 })}>
      {STEP_KEYS.map((k, i) => (
        <span key={k} className={cn(
          "flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium",
          i === step ? "border-primary bg-primary/10 text-primary"
            : i < step ? "border-primary/40 bg-primary/5 text-primary/80" : "border-border text-muted-foreground",
        )}>
          {i < step ? <Check className="size-3" aria-hidden /> : <span aria-hidden>{i + 1}</span>}
          {t(k)}
        </span>
      ))}
    </div>
  );
}

function BookingFlow({ initial }: { initial: BookingPrefill }) {
  const { t } = useI18n();
  const [step, setStep] = useState(initial.deptCode ? (initial.doctorId ? 2 : 1) : 0);
  const [deptCode, setDeptCode] = useState(initial.deptCode ?? "");
  const [doctorId, setDoctorId] = useState(initial.doctorId ?? "");
  const [slot, setSlot] = useState<SlotDto | null>(null);
  const [request, setRequest] = useState<BookingRequestRes | null>(null);
  const [result, setResult] = useState<BookingVerifyRes | null>(null);

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-center">{t("public.booking.dialog.title")}</DialogTitle>
        <DialogDescription className="text-center">
          {step < 4 ? t("public.booking.step.of", { n: step + 1, m: 4 }) : step === 4 ? t("public.booking.otp.title") : t("public.booking.success.title")}
        </DialogDescription>
        {step < 4 ? <div className="mt-1"><Stepper step={step} /></div> : null}
      </DialogHeader>

      {step === 0 ? (
        <DeptStep selected={deptCode} onSelect={(code) => { setDeptCode(code); setDoctorId(""); setStep(1); }} />
      ) : step === 1 ? (
        <DoctorStep deptCode={deptCode} selected={doctorId} onChange={setDoctorId} onNext={() => setStep(2)} onBack={() => setStep(0)} />
      ) : step === 2 ? (
        <SlotStep deptCode={deptCode} doctorId={doctorId} onPick={(s) => { setSlot(s); setStep(3); }} onBack={() => setStep(1)} />
      ) : step === 3 && slot ? (
        <DetailsStep slot={slot} deptCode={deptCode} onBack={() => setStep(2)} onSent={(r) => { setRequest(r); setStep(4); }} />
      ) : step === 4 && request ? (
        <OtpStep request={request} onVerified={(r) => { setResult(r); setStep(5); }} />
      ) : step === 5 && result ? (
        <SuccessStep result={result} onClose={() => useBooking.getState().closeBooking()} />
      ) : null}
    </>
  );
}

export function BookingDialog() {
  const { open, prefill, seq, closeBooking } = useBooking();
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) closeBooking(); }}>
      <DialogContent className="sm:max-w-2xl max-h-[88vh] overflow-y-auto">
        <BookingFlow key={seq} initial={prefill} />
      </DialogContent>
    </Dialog>
  );
}

/** the marketing CTA panel for the booking flow */
export function BookingSection() {
  const { t } = useI18n();
  const openBooking = useBooking((s) => s.openBooking);
  return (
    <Section id="booking" className="bg-muted/40">
      <div className="mx-auto max-w-[1600px] px-4 md:px-6">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-l from-teal-700 via-teal-600 to-emerald-600 p-6 md:p-12 text-center text-white shadow-xl shadow-teal-900/10">
          <div aria-hidden className="pointer-events-none absolute -top-20 -end-20 size-72 rounded-full bg-emerald-300/20 blur-3xl" />
          <div aria-hidden className="pointer-events-none absolute -bottom-24 -start-16 size-72 rounded-full bg-cyan-200/15 blur-3xl" />
          <h2 className="relative text-2xl md:text-4xl font-bold tracking-tight">{t("public.booking.section.title")}</h2>
          <p className="relative mx-auto mt-3 max-w-2xl text-sm md:text-base text-white/85">{t("public.booking.section.subtitle")}</p>
          <div className="relative mt-6">
            <Button size="lg" onClick={() => openBooking()} className="h-12 px-8 bg-white text-teal-800 hover:bg-white/90 shadow-lg shadow-teal-900/30">
              <CalendarPlus aria-hidden /> {t("public.booking.section.cta")}
            </Button>
          </div>
          <p className="relative mt-3 text-xs text-white/75">{t("public.booking.section.note")}</p>
        </div>
      </div>
    </Section>
  );
}
