"use client";
/**
 * Tab 5 — الأمان والامتثال: static bilingual compliance checklist (spec §16)
 * — MFA, FIDO2, blind-index encryption, hash chain, patient rights (DSR),
 * RoPA/DPIA, NHRA licenses, data residency — each with a status chip.
 */
import { useI18n } from "@/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ClipboardCheck, Eye, Fingerprint, HardDrive, KeyRound, Landmark, Link2, ShieldCheck } from "lucide-react";
import { Section } from "./bits";

type SecStatus = "applied" | "verified" | "progress";

const ITEMS: { key: string; icon: typeof ShieldCheck; status: SecStatus }[] = [
  { key: "mfa", icon: KeyRound, status: "applied" },
  { key: "fido2", icon: Fingerprint, status: "applied" },
  { key: "blind", icon: ShieldCheck, status: "applied" },
  { key: "chain", icon: Link2, status: "applied" },
  { key: "dsr", icon: Eye, status: "applied" },
  { key: "ropa", icon: ClipboardCheck, status: "verified" },
  { key: "nhra", icon: Landmark, status: "verified" },
  { key: "residency", icon: HardDrive, status: "progress" },
];

const STATUS_TONE: Record<SecStatus, string> = {
  applied: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  verified: "bg-teal-100 text-teal-900 dark:bg-teal-950 dark:text-teal-200",
  progress: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
};

export default function AdminSecurity() {
  const { t } = useI18n();
  return (
    <Section title={t("admin.tab.security")} sub={t("admin.security.sub")}>
      <div className="grid gap-4 md:grid-cols-2">
        {ITEMS.map(({ key, icon: Icon, status }) => (
          <Card key={key} className="p-0">
            <CardContent className="p-4 flex items-start gap-3">
              <span className="grid size-10 place-items-center rounded-lg bg-muted text-primary shrink-0" aria-hidden>
                <Icon className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold">{t(`admin.sec.${key}.title`)}</h3>
                  <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold", STATUS_TONE[status])}>
                    {t(`admin.security.status.${status}`)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed mt-1">{t(`admin.sec.${key}.desc`)}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="rounded-xl border bg-primary/5 p-4 flex items-start gap-3">
        <ClipboardCheck className="size-5 text-primary shrink-0 mt-0.5" aria-hidden />
        <p className="text-sm">{t("admin.security.note")}</p>
      </div>
    </Section>
  );
}
