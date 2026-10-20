"use client";
/**
 * reception-register — new-patient registration (§17.2/17.3).
 * chip mode: identity fields locked from smart-card read; extras editable.
 * manual mode: full keyboard entry with duplicate-guard warnings.
 */
import { useMemo, useState } from "react";
import { apiPost } from "@/lib/api-client";
import { useI18n, bi } from "@/i18n";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PAYERS, errText, setLastPatient, type ChipRecord, type RegisterResp } from "./emr-shared";
import { Lock, OctagonX, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export type RegisterMode = "chip" | "manual";

interface Props {
  mode: RegisterMode;
  chip: ChipRecord | null;
  similarCount: number;
  onCancel: () => void;
  onRegistered: (r: RegisterResp) => void;
}

function Field({ label, locked, children, hint }: { label: string; locked?: boolean; children: React.ReactNode; hint?: string }) {
  return (
    <div className="grid gap-1">
      <Label className="text-xs flex items-center gap-1.5">
        {label}
        {locked && <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 gap-0.5 bg-teal-50 text-teal-800 dark:bg-teal-950 dark:text-teal-200"><Lock aria-hidden />{hint}</Badge>}
      </Label>
      {children}
    </div>
  );
}

export function RegisterForm({ mode, chip, similarCount, onCancel, onRegistered }: Props) {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const locked = mode === "chip";
  const [firstAr, setFirstAr] = useState(chip?.namePartsAr.first ?? "");
  const [fatherAr, setFatherAr] = useState(chip?.namePartsAr.father ?? "");
  const [familyAr, setFamilyAr] = useState(chip?.namePartsAr.family ?? "");
  const [firstEn, setFirstEn] = useState("");
  const [familyEn, setFamilyEn] = useState("");
  const [cpr, setCpr] = useState(chip?.idNumber ?? "");
  const [dob, setDob] = useState(chip?.dob?.slice(0, 10) ?? "");
  const [gender, setGender] = useState(chip?.gender ?? "male");
  const [phone, setPhone] = useState(chip?.phone ?? "+973");
  const [motherAr, setMotherAr] = useState("");
  const [payerId, setPayerId] = useState("");
  const [membershipNo, setMembershipNo] = useState("");
  const [area, setArea] = useState(chip?.address.area ?? "");
  const [block, setBlock] = useState(chip?.address.block ?? "");
  const [busy, setBusy] = useState(false);
  const [dupErr, setDupErr] = useState<string | null>(null);
  const [confirmDup, setConfirmDup] = useState(false);

  const payer = useMemo(() => PAYERS.find((p) => p.id === payerId) ?? null, [payerId]);
  const valid = firstAr.trim() && familyAr.trim() && dob && phone.trim().length >= 8;

  const submit = async (force = false) => {
    if (!valid || busy) return;
    if (!force && similarCount > 0) { setConfirmDup(true); return; }
    setConfirmDup(false);
    setBusy(true); setDupErr(null);
    try {
      const r = await apiPost<RegisterResp>("/api/staff/patients/register", {
        firstAr: firstAr.trim(), fatherAr: fatherAr.trim(), familyAr: familyAr.trim(),
        firstEn: firstEn.trim() || undefined, familyEn: familyEn.trim() || undefined,
        latinName: firstEn.trim() ? `${firstEn.trim()} ${familyEn.trim()}` : undefined,
        dob, gender, phone: phone.trim(),
        cpr: cpr.replace(/\D/g, "") || undefined,
        motherAr: motherAr.trim() || undefined,
        nationality: chip?.nationality ?? "البحرين",
        address: chip?.address ? { ...chip.address, area, block } : { area, block },
        source: locked ? "chip" : "manual",
        assurance: locked ? 1 : 3,
        payerId: payer?.id, copayFils: payer?.copayFils, coinsPct: payer?.coinsPct,
        membershipNo: membershipNo.trim() || undefined,
      });
      toast({ title: t("rec.register.ok"), description: t("rec.register.mrn", { mrn: r.mrn }) });
      setLastPatient({ id: r.id, mrn: r.mrn, nameAr: r.nameAr });
      onRegistered(r);
    } catch (e) {
      const problem = (e as { problem?: Record<string, unknown> }).problem;
      if (problem?.code === "ID_DUPLICATE") setDupErr(t("rec.register.dup", { mrn: String(problem.existingMrn ?? "") }));
      else setDupErr(errText(e, lang));
      toast({ title: t("common.error"), description: errText(e, lang), variant: "destructive" });
    } finally { setBusy(false); }
  };

  return (
    <div className="rounded-lg border p-4 grid gap-4">
      <div className="flex items-center gap-2 flex-wrap">
        <h3 className="text-sm font-semibold">{t("rec.register.title")}</h3>
        {locked && <Badge className="bg-emerald-600 border-transparent text-white">{t("rec.register.chipverified")}</Badge>}
        <Button size="sm" variant="ghost" className="ms-auto h-8" onClick={onCancel}>{t("common.cancel")}</Button>
      </div>

      {dupErr && <div role="alert" className="rounded-md border border-red-300 bg-red-50 dark:bg-red-950/40 p-3 text-xs text-red-800 dark:text-red-200 flex items-center gap-2"><OctagonX className="size-4 shrink-0" aria-hidden />{dupErr}</div>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label={t("rec.f.firstAr")} locked={locked} hint={t("rec.chip")}>
          <Input value={firstAr} readOnly={locked} onChange={(e) => setFirstAr(e.target.value)} className="h-9" />
        </Field>
        <Field label={t("rec.f.fatherAr")} locked={locked} hint={t("rec.chip")}>
          <Input value={fatherAr} readOnly={locked} onChange={(e) => setFatherAr(e.target.value)} className="h-9" />
        </Field>
        <Field label={t("rec.f.familyAr")} locked={locked} hint={t("rec.chip")}>
          <Input value={familyAr} readOnly={locked} onChange={(e) => setFamilyAr(e.target.value)} className="h-9" />
        </Field>
        {!locked && (
          <>
            <Field label={t("rec.f.firstEn")}><Input value={firstEn} onChange={(e) => setFirstEn(e.target.value)} className="h-9" dir="ltr" /></Field>
            <Field label={t("rec.f.familyEn")}><Input value={familyEn} onChange={(e) => setFamilyEn(e.target.value)} className="h-9" dir="ltr" /></Field>
            <Field label={t("rec.f.cpr")}><Input value={cpr} onChange={(e) => setCpr(e.target.value)} className="h-9 font-mono" dir="ltr" inputMode="numeric" placeholder="9XXXXXXXX" /></Field>
          </>
        )}
        {locked && (
          <Field label={t("rec.f.cpr")} locked hint={t("rec.chip")}>
            <Input value={cpr} readOnly className="h-9 font-mono" dir="ltr" />
          </Field>
        )}
        <Field label={t("rec.f.dob")} locked={locked} hint={t("rec.chip")}>
          <Input type="date" value={dob} readOnly={locked} onChange={(e) => setDob(e.target.value)} className="h-9" dir="ltr" />
        </Field>
        <Field label={t("common.gender")} locked={locked} hint={t("rec.chip")}>
          <Select value={gender} onValueChange={setGender} disabled={locked}>
            <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="male" className="text-xs">{t("common.male")}</SelectItem>
              <SelectItem value="female" className="text-xs">{t("common.female")}</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label={t("common.phone")} locked={locked} hint={t("rec.chip")}>
          <Input value={phone} readOnly={locked} onChange={(e) => setPhone(e.target.value)} className="h-9 font-mono" dir="ltr" inputMode="tel" />
        </Field>
        <Field label={t("rec.f.area")} locked={locked} hint={t("rec.chip")}>
          <Input value={area} readOnly={locked} onChange={(e) => setArea(e.target.value)} className="h-9" />
        </Field>
        <Field label={t("rec.f.block")} locked={locked} hint={t("rec.chip")}>
          <Input value={block} readOnly={locked} onChange={(e) => setBlock(e.target.value)} className="h-9 font-mono" dir="ltr" />
        </Field>
        <Field label={t("rec.f.motherAr")}><Input value={motherAr} onChange={(e) => setMotherAr(e.target.value)} className="h-9" /></Field>
        <Field label={t("rec.f.payer")}>
          <Select value={payerId} onValueChange={setPayerId}>
            <SelectTrigger className="h-9 text-xs"><SelectValue placeholder={t("common.select")} /></SelectTrigger>
            <SelectContent>
              {PAYERS.map((p) => <SelectItem key={p.id} value={p.id} className="text-xs">{bi(lang, p.ar, p.en)}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        {payer && (
          <Field label={t("rec.f.membership")}>
            <Input value={membershipNo} onChange={(e) => setMembershipNo(e.target.value)} className="h-9 font-mono" dir="ltr" />
          </Field>
        )}
      </div>

      {payer && (
        <div className="rounded-md bg-muted/60 border p-2.5 text-xs flex flex-wrap gap-x-4 gap-y-1">
          <span className="inline-flex items-center gap-1.5"><ShieldCheck className="size-3.5 shrink-0" aria-hidden />{bi(lang, payer.ar, payer.en)}</span>
          <span>{t("rec.f.copay")}: <b className="font-mono">{(payer.copayFils / 1000).toFixed(3)}</b> {t("money.currency")}</span>
          <span>{t("rec.f.coins")}: <b className="font-mono">{payer.coinsPct}%</b></span>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button className="h-10 px-6" disabled={!valid || busy} onClick={() => submit(false)}>{busy ? t("common.loading") : t("rec.register.submit")}</Button>
        <span className={cn("text-xs", valid ? "text-muted-foreground" : "text-amber-600")}>{valid ? t("rec.register.hint") : t("rec.register.invalid")}</span>
      </div>

      <AlertDialog open={confirmDup} onOpenChange={setConfirmDup}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("rec.register.dupTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("rec.register.dupBody", { n: similarCount })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => submit(true)}>{t("rec.register.proceed")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
