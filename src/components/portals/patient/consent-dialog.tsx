"use client";
/**
 * Consent signing dialog — full bilingual body, mandatory read timer
 * (template.minReadSec enforced server-side via readSeconds), demo OTP (1234),
 * POST /api/patient/consents/sign with error surfacing; success shows code.
 */
import { useEffect, useRef, useState } from "react";
import { useI18n, bi } from "@/i18n";
import { apiGet, apiPost } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { errText, type ConsentTemplate, type SignedConsent } from "./lib";
import { CheckCircle2, Loader2, Timer } from "lucide-react";

export const CONSENT_ID_MAP = "bmc-consent-ids";
export function rememberConsentId(code: string, id: string) {
  try {
    const m = JSON.parse(sessionStorage.getItem(CONSENT_ID_MAP) ?? "{}") as Record<string, string>;
    m[code] = id;
    sessionStorage.setItem(CONSENT_ID_MAP, JSON.stringify(m));
  } catch { /* private mode */ }
}

export default function ConsentDialog({
  template, open, onOpenChange, onSigned,
}: { template: ConsentTemplate | null; open: boolean; onOpenChange: (o: boolean) => void; onSigned: () => void }) {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const [elapsed, setElapsed] = useState(0);
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState<{ code: string } | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (open && template) {
      setElapsed(0); setOtp(""); setSuccess(null); setBusy(false);
      const started = Date.now();
      timer.current = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 500);
      return () => { if (timer.current) clearInterval(timer.current); };
    }
    return undefined;
  }, [open, template]);

  if (!template) return null;
  const min = template.minReadSec;
  const readOk = elapsed >= min;
  const left = Math.max(0, min - elapsed);

  const submit = async () => {
    setBusy(true);
    try {
      const r = await apiPost<{ id: string }>("/api/patient/consents/sign", { templateKey: template.key, otp, readSeconds: elapsed });
      // find the freshly signed consent code for display + remember its id for withdraw
      try {
        const list = await apiGet<{ signed: SignedConsent[] }>("/api/patient/consents");
        const mine = (list.signed ?? []).find((c) => c.templateKey === template.key && c.status === "active");
        if (mine) { rememberConsentId(mine.code, r.id); setSuccess({ code: mine.code }); }
        else setSuccess({ code: r.id });
      } catch { setSuccess({ code: r.id }); }
      onSigned();
    } catch (e) {
      toast({ title: t("common.error"), description: errText(e, lang), variant: "destructive" });
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{bi(lang, template.titleAr, template.titleEn)}</DialogTitle>
        </DialogHeader>
        {success ? (
          <div className="grid gap-3 text-center">
            <CheckCircle2 className="mx-auto size-12 text-emerald-600" aria-hidden />
            <p className="font-semibold">{t("pp.con.signDone", { code: success.code })}</p>
            <Button className="min-h-11" onClick={() => onOpenChange(false)}>{t("common.close")}</Button>
          </div>
        ) : (
          <div className="grid gap-3">
            <div className="max-h-48 overflow-y-auto whitespace-pre-line rounded-xl border bg-muted/40 p-3 text-sm leading-6" dir={lang === "ar" ? "rtl" : "ltr"}>
              {bi(lang, template.bodyAr, template.bodyEn)}
            </div>
            <div className="grid gap-1.5">
              <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Timer className="size-3.5" aria-hidden />
                {readOk ? t("pp.con.readDone") : t("pp.con.reading", { left })}
              </p>
              <Progress value={Math.min(100, (elapsed / Math.max(1, min)) * 100)} className="h-1.5" aria-label={`${elapsed}/${min}s`} />
            </div>
            <div className="grid justify-items-center gap-1.5">
              <label htmlFor="consent-otp" className="text-xs font-medium text-muted-foreground">{t("pp.con.otp")}</label>
              <InputOTP id="consent-otp" maxLength={4} value={otp} onChange={setOtp} disabled={!readOk} dir="ltr">
                <InputOTPGroup>
                  <InputOTPSlot index={0} className="size-11" /><InputOTPSlot index={1} className="size-11" />
                  <InputOTPSlot index={2} className="size-11" /><InputOTPSlot index={3} className="size-11" />
                </InputOTPGroup>
              </InputOTP>
              <p className="text-[11px] text-muted-foreground">{t("pp.con.otpHint")}</p>
            </div>
            <Button className="min-h-11" disabled={!readOk || otp.length < 4 || busy} onClick={submit}>
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}{t("pp.con.agree")}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
