"use client";
/** Guest booking — zustand trigger + multi-step dialog shell + the Shamel
 *  guide CTA panel (grad-hero rounded card + hero-pattern) as the marketing
 *  section. Step bodies live in booking-steps.tsx / booking-final.tsx. */
import { useState } from "react";
import { create } from "zustand";
import { CalendarPlus, Check } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import { Container, Section, SectionHeader } from "../section-shell";
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
    <div className="flex flex-wrap items-center justify-center gap-1.5" aria-label={t("public.booking.step.of", { n: step + 1, m: 4 })}>
      {STEP_KEYS.map((k, i) => (
        <span key={k} className={cn(
          "badge gap-1.5",
          i === step ? "solid-teal" : i < step ? "b-teal" : "b-slate",
        )}>
          {i < step ? <Check className="size-3" aria-hidden /> : <span aria-hidden className="num">{i + 1}</span>}
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

/** the marketing CTA panel for the booking flow — guide CTA pattern */
export function BookingSection() {
  const { t } = useI18n();
  const openBooking = useBooking((s) => s.openBooking);
  return (
    <Section id="booking" className="alt">
      <Container>
        <div
          className="relative overflow-hidden rounded-[28px] p-8 text-white shadow-xl md:p-14"
          style={{ background: "var(--grad-hero)" }}
        >
          <div className="hero-pattern" aria-hidden />
          <div className="relative z-[1] flex flex-wrap items-center gap-8">
            <div className="min-w-[280px] flex-1">
              <SectionHeader
                eyebrow={t("public.booking.eyebrow")}
                title={t("public.booking.section.title")}
                subtitle={t("public.booking.section.subtitle")}
                light
              />
            </div>
            <div className="flex w-full flex-col items-stretch gap-3 sm:w-auto sm:items-center">
              <button className="btn btn-gold btn-xl" onClick={() => openBooking()}>
                <CalendarPlus className="size-5" aria-hidden /> {t("public.booking.section.cta")}
              </button>
              <p className="text-xs text-white/75">{t("public.booking.section.note")}</p>
            </div>
          </div>
        </div>
      </Container>
    </Section>
  );
}
