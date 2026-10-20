"use client";
/**
 * Section 5 — الأمان والامتثال (Shamel guide admin pattern): static bilingual
 * compliance checklist (spec §16) — MFA, FIDO2, blind-index encryption, hash
 * chain, patient rights (DSR), RoPA/DPIA, NHRA licenses, data residency —
 * each as a Shamel card with a status badge chip.
 */
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import { ClipboardCheck, Eye, Fingerprint, HardDrive, KeyRound, Landmark, Link2, ShieldCheck } from "lucide-react";

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
  applied: "b-green",
  verified: "b-teal",
  progress: "b-amber",
};

const STATUS_ICON: Record<SecStatus, string> = {
  applied: "ic-green",
  verified: "ic-teal",
  progress: "ic-amber",
};

export default function AdminSecurity() {
  const { t } = useI18n();
  return (
    <div className="stack-sm">
      <div className="grid gap-4 md:grid-cols-2">
        {ITEMS.map(({ key, icon: Icon, status }) => (
          <div key={key} className="card p-0">
            <div className="card-body flex items-start gap-3 p-4">
              <span className={cn("ch-ic shrink-0", STATUS_ICON[status])} aria-hidden>
                <Icon className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-bold">{t(`admin.sec.${key}.title`)}</h3>
                  <span className={cn("badge sm shrink-0", STATUS_TONE[status])}>
                    <span className="dot" aria-hidden />
                    {t(`admin.security.status.${status}`)}
                  </span>
                </div>
                <p className="card-desc mt-1 text-xs leading-relaxed">{t(`admin.sec.${key}.desc`)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="alert alert-gold">
        <span className="al-ic"><ClipboardCheck className="size-5" aria-hidden /></span>
        <div>{t("admin.security.note")}</div>
      </div>
    </div>
  );
}
