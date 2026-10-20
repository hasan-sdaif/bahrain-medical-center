"use client";
/**
 * Documents — verified document cards (report / certificate / referral /
 * implant-card / prescription-print / invoice-print). Each card carries its
 * verifyCode (QR + mono text + copy) checkable on verify.website.bh.
 */
import { useI18n, bi } from "@/i18n";
import { apiGet } from "@/lib/api-client";
import { useApp } from "@/store/app";
import { useToast } from "@/hooks/use-toast";
import { bhDateString } from "@/lib/bahrain";
import { QrCode } from "@/components/shared/barcode";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorBox, LoadingRows, SectionCard } from "./parts";
import { PageHead } from "./shell-ui";
import { useFetch, type DocItem, type OverviewPayload } from "./lib";
import {
  Award, Copy, CreditCard, ExternalLink, FileText, Pill, Receipt, Send, type LucideIcon,
} from "lucide-react";

const KIND_ICON: Record<string, LucideIcon> = {
  report: FileText, certificate: Award, referral: Send, "implant-card": CreditCard,
  "prescription-print": Pill, "invoice-print": Receipt,
};

const KIND_TONE: Record<string, string> = {
  report: "ic-teal", certificate: "ic-gold", referral: "ic-sky", "implant-card": "ic-rose",
  "prescription-print": "ic-violet", "invoice-print": "ic-amber",
};

function DocCard({ d, onCopy }: { d: DocItem; onCopy: (code: string) => void }) {
  const { t, lang } = useI18n();
  const Icon = KIND_ICON[d.kind] ?? FileText;
  return (
    <li className="card">
      <div className="card-head">
        <div className="ch-title">
          <span className={`ch-ic ${KIND_TONE[d.kind] ?? "ic-teal"}`} aria-hidden><Icon className="size-4" /></span>
          <span className="min-w-0">
            <span className="block truncate">{bi(lang, d.titleAr, d.titleEn)}</span>
            <span className="ch-sub block">{t("pp.doc.issuedAt")}: <span className="mono">{bhDateString(d.issuedAt)}</span></span>
          </span>
        </div>
        <div className="ch-tools"><span className="tag shrink-0">{t(`pp.doc.kind.${d.kind}`)}</span></div>
      </div>
      <div className="card-body grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface-2 p-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-ink-3">{t("pp.doc.code")}</p>
            <p className="mono mt-0.5 break-all text-xs font-bold">{d.verifyCode}</p>
            <Button
              variant="outline" size="sm" className="mt-2 min-h-11"
              onClick={() => onCopy(d.verifyCode)} aria-label={t("pp.doc.copy")}
            >
              <Copy className="size-4" aria-hidden />{t("pp.doc.copy")}
            </Button>
          </div>
          <QrCode value={d.verifyCode} size={92} className="rounded-lg border border-line bg-white p-1" />
        </div>
      </div>
    </li>
  );
}

export default function DocumentsScreen() {
  const { t } = useI18n();
  const { toast } = useToast();
  const setDomain = useApp((s) => s.setDomain);
  const data = useFetch<OverviewPayload>(() => apiGet<OverviewPayload>("/api/patient/overview"));

  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      toast({ title: t("pp.doc.copied"), description: code });
    } catch {
      toast({ title: t("common.error"), description: code, variant: "destructive" });
    }
  };

  const docs = data.data?.documents ?? [];

  return (
    <div className="grid gap-4">
      <PageHead icon={FileText} title={t("pp.doc.title")} sub={t("pp.doc.sub")} />

      {data.loading ? <LoadingRows n={3} h="h-48" /> : data.error ? <ErrorBox error={data.error} onRetry={data.reload} /> : (
        <>
          <SectionCard contentClassName="p-0">
            {docs.length ? (
              <ul className="list-group gap-3 p-4 lg:grid lg:grid-cols-2" role="list">
                {docs.map((d) => <DocCard key={d.id} d={d} onCopy={copy} />)}
              </ul>
            ) : <EmptyState icon={FileText} text={t("pp.doc.empty")} />}
          </SectionCard>

          <SectionCard>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="flex-1 text-sm text-muted-foreground">{t("pp.doc.scanHint")}</p>
              <Button className="min-h-11" onClick={() => setDomain("verify")}>
                <ExternalLink className="size-4" aria-hidden />{t("pp.doc.verifyNow")}
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{t("pp.doc.hint")}</p>
          </SectionCard>
        </>
      )}
    </div>
  );
}
