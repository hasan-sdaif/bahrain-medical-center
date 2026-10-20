"use client";
/**
 * PatientBanner — fixed chart header (spec §6.4): identity, MRN barcode,
 * masked ID, flags, assurance level. Shown on every patient-scoped screen.
 */
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Code128 } from "./barcode";
import { FlagBadges } from "./badges";
import { useI18n } from "@/i18n";
import { bi } from "@/i18n";
import { cn } from "@/lib/utils";

export interface BannerData {
  mrn: string; nameAr: string; nameEn?: string | null; age?: number; gender?: string;
  idMasked?: string; assurance?: number; phone?: string | null; bloodType?: string | null;
  flags?: { kind: string; valueAr?: string | null; valueEn?: string | null; severity?: string | null }[];
  insurance?: { payerAr?: string; membershipNo?: string } | null;
  address?: Record<string, unknown>;
}

const ASSURANCE_LABELS: Record<number, { ar: string; en: string; tone: string }> = {
  1: { ar: "موثّق بالرقاقة", en: "Chip-verified", tone: "bg-emerald-600 text-white" },
  2: { ar: "توثيق بصري", en: "Visual check", tone: "bg-teal-600 text-white" },
  3: { ar: "مصرّح ذاتياً", en: "Self-declared", tone: "bg-amber-500 text-white" },
  4: { ar: "مؤقت", en: "Temporary", tone: "bg-zinc-500 text-white" },
};

export function PatientBanner({ data, className, compact = false }: { data: BannerData | null; className?: string; compact?: boolean }) {
  const { t, lang } = useI18n();
  if (!data) {
    return (
      <Card className={cn("p-3 flex items-center gap-3 text-muted-foreground", className)}>
        <Avatar><AvatarFallback>—</AvatarFallback></Avatar>
        <div className="text-sm">{t("patientbanner.unknown")}</div>
      </Card>
    );
  }
  const assurance = ASSURANCE_LABELS[data.assurance ?? 3] ?? ASSURANCE_LABELS[3];
  const initials = (data.nameAr ?? "?").split(" ").map((w) => w[0]).slice(0, 2).join("");
  return (
    <Card className={cn("p-3 md:p-4 flex flex-wrap items-center gap-3 md:gap-4", className)}>
      <Avatar className="size-11 md:size-12 border">
        <AvatarFallback className="bg-primary/10 text-primary font-semibold">{initials}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-semibold text-base md:text-lg truncate">{bi(lang, data.nameAr, data.nameEn)}</h2>
          {data.age != null && <span className="text-sm text-muted-foreground">{data.age}{t("common.years")} · {t(`common.${data.gender ?? "male"}`)}</span>}
          {data.bloodType && <span className="text-sm text-muted-foreground">{data.bloodType}</span>}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground mt-0.5">
          <span className="font-mono">{t("patientbanner.mrn")}: {data.mrn}</span>
          {data.idMasked && <span className="font-mono">{data.idMasked}</span>}
          {data.phone && <span dir="ltr" className="font-mono">{data.phone}</span>}
          {data.insurance && <span>{data.insurance.payerAr} · {data.insurance.membershipNo}</span>}
        </div>
        <div className="mt-1.5"><FlagBadges flags={data.flags ?? []} /></div>
      </div>
      <div className="flex flex-col items-end gap-2 ms-auto">
        <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", assurance.tone)}>
          {bi(lang, assurance.ar, assurance.en)}
        </span>
        {!compact && <div className="bg-white text-black dark:bg-zinc-100 rounded-md px-2 py-1 shadow-sm"><Code128 value={data.mrn} height={34} /></div>}
      </div>
    </Card>
  );
}
