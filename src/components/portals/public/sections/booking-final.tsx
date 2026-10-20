"use client";
/** Booking steps 4-6 — guest details + OTP confirmation + success with barcode. */
import { useState } from "react";
import { BadgeCheck, CalendarClock, CheckCircle2, Loader2, ScanBarcode } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { Code128 } from "@/components/shared/barcode";
import { MoneyText } from "@/components/shared/badges";
import { bi, useI18n } from "@/i18n";
import { apiPost } from "@/lib/api-client";
import { bhDateString, bhTimeString } from "@/lib/bahrain";
import { useApp } from "@/store/app";
import { useToast } from "@/hooks/use-toast";
import { bhPhoneLocal, problemDetail, usePublicData } from "../data";
import { DirArrow } from "../section-shell";
import type { BookingRequestRes, BookingVerifyRes, SlotDto } from "./booking";

export function DetailsStep({ slot, deptCode, onBack, onSent }: {
  slot: SlotDto; deptCode: string; onBack: () => void; onSent: (r: BookingRequestRes) => void;
}) {
  const { lang, t } = useI18n();
  const { data } = usePublicData();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [errName, setErrName] = useState(false);
  const [errPhone, setErrPhone] = useState(false);
  const [busy, setBusy] = useState(false);
  const dept = data.departments.find((d) => d.code === deptCode);

  const submit = async () => {
    const local = bhPhoneLocal(phone);
    const okName = name.trim().length >= 3;
    setErrName(!okName); setErrPhone(!local);
    if (!okName || !local) return;
    setBusy(true);
    try {
      const r = await apiPost<BookingRequestRes>("/api/public/booking/request", {
        nameAr: name.trim(), phone: `+973${local}`, slot: slot.at, doctorId: slot.doctorId, deptCode,
      });
      onSent(r);
    } catch (e) {
      toast({ title: t("common.error"), description: problemDetail(e, lang) ?? t("public.booking.error"), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="rounded-xl border bg-muted/40 p-4 space-y-2 text-sm">
        <p className="font-semibold text-muted-foreground">{t("public.booking.summary")}</p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {dept ? <span className="font-medium">{bi(lang, dept.nameAr, dept.nameEn)}</span> : null}
          <span>{bi(lang, slot.doctorAr, slot.doctorEn)}</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground">
          <span className="flex items-center gap-1.5"><CalendarClock className="size-4" aria-hidden />
            <span dir="ltr" className="tabular-nums">{bhDateString(slot.at)} · {bhTimeString(slot.at)}</span>
          </span>
          <span>{t("public.booking.price")}: <MoneyText fils={slot.priceFils} className="font-semibold text-foreground" /></span>
        </div>
      </div>

      <div className="mt-4 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="bk-name">{t("public.booking.name")}</Label>
          <Input id="bk-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("public.booking.name.ph")}
            aria-invalid={errName} className="h-11" autoComplete="name" />
          {errName ? <p className="text-xs text-destructive">{t("public.booking.name.err")}</p> : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="bk-phone">{t("public.booking.phone")}</Label>
          <Input id="bk-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t("public.booking.phone.ph")}
            aria-invalid={errPhone} inputMode="tel" dir="ltr" className="h-11 text-start" autoComplete="tel" />
          {errPhone ? <p className="text-xs text-destructive">{t("public.booking.phone.err")}</p>
            : <p className="text-xs text-muted-foreground">{t("public.booking.phone.hint")}</p>}
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={onBack} disabled={busy} className="h-11 px-5"><DirArrow back /> {t("common.back")}</Button>
        <Button onClick={submit} disabled={busy} className="h-11 px-6">
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          {busy ? t("public.booking.requesting") : t("public.booking.request")} <DirArrow />
        </Button>
      </div>
    </div>
  );
}

export function OtpStep({ request, onVerified }: { request: BookingRequestRes; onVerified: (r: BookingVerifyRes) => void }) {
  const { lang, t } = useI18n();
  const { toast } = useToast();
  const [otp, setOtp] = useState("");
  const [invalid, setInvalid] = useState(false);
  const [busy, setBusy] = useState(false);

  const verify = async (code: string) => {
    setBusy(true); setInvalid(false);
    try {
      const r = await apiPost<BookingVerifyRes>("/api/public/booking/verify", { bookingId: request.id, otp: code });
      onVerified(r);
    } catch (e) {
      if ((e as { status?: number }).status === 401) {
        setInvalid(true); setOtp("");
      } else {
        toast({ title: t("common.error"), description: problemDetail(e, lang) ?? t("public.booking.error"), variant: "destructive" });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <Alert className="border-amber-300 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-800">
        <AlertTitle className="text-sm">{t("public.booking.otp.demo.note")}</AlertTitle>
        <AlertDescription>
          <span className="mt-1 block text-center text-3xl font-bold font-mono tracking-[0.6em] text-amber-700 dark:text-amber-300" dir="ltr">
            {request.otpDemo}
          </span>
        </AlertDescription>
      </Alert>

      <div className="space-y-2 text-center">
        <p className="text-sm text-muted-foreground">{t("public.booking.otp.hint")}</p>
        <div className="flex justify-center" dir="ltr">
          <InputOTP maxLength={4} value={otp} disabled={busy} onChange={(v) => { setOtp(v); if (v.length === 4) void verify(v); }} aria-label="OTP">
            <InputOTPGroup>
              {[0, 1, 2, 3].map((i) => <InputOTPSlot key={i} index={i} className="size-12 text-lg" />)}
            </InputOTPGroup>
          </InputOTP>
        </div>
        {invalid ? <p className="text-sm text-destructive">{t("public.booking.otp.invalid")}</p> : null}
      </div>

      <div className="flex justify-center">
        <Button onClick={() => void verify(otp)} disabled={busy || otp.length < 4} className="h-11 min-w-40">
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <BadgeCheck aria-hidden />}
          {busy ? t("public.booking.otp.verifying") : t("public.booking.otp.verify")}
        </Button>
      </div>
    </div>
  );
}

export function SuccessStep({ result, onClose }: { result: BookingVerifyRes; onClose: () => void }) {
  const { lang, t } = useI18n();
  const setDomain = useApp((s) => s.setDomain);
  return (
    <div className="space-y-5 text-center">
      <span className="mx-auto grid size-14 place-items-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
        <CheckCircle2 className="size-8" aria-hidden />
      </span>

      <div className="rounded-xl border bg-muted/40 p-4 space-y-3">
        <div>
          <p className="text-xs text-muted-foreground">{t("public.booking.success.appt")}</p>
          <p className="mt-1 text-xl font-bold font-mono tracking-wider" dir="ltr">{result.appointment.code}</p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-sm text-muted-foreground">
          <span>{t("public.booking.success.at")}: <span dir="ltr" className="font-medium text-foreground tabular-nums">{bhDateString(result.appointment.start)} · {bhTimeString(result.appointment.start)}</span></span>
          <span>{t("public.booking.success.mrn")}: <span dir="ltr" className="font-mono font-medium text-foreground">{result.patient.mrn}</span></span>
        </div>
        <div className="rounded-lg bg-white dark:bg-background p-3 border">
          <Code128 value={result.appointment.code} height={52} className="mx-auto" />
          <p className="mt-1 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground"><ScanBarcode className="size-3.5" aria-hidden /> {t("public.booking.success.barcode.hint")}</p>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">{bi(lang, result.noteAr, result.noteEn) || t("public.booking.success.note")}</p>

      <div className="flex flex-wrap justify-center gap-3">
        <Button onClick={() => { onClose(); setDomain("patient"); }} className="h-11 px-6">{t("public.booking.success.portal")}</Button>
        <Button variant="outline" onClick={onClose} className="h-11 px-6">{t("common.close")}</Button>
      </div>
      <Badge variant="outline" className="font-normal text-muted-foreground">{result.patient.nameAr}</Badge>
    </div>
  );
}
