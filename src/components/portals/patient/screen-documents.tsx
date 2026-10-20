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
import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorBox, LoadingRows, SectionCard } from "./parts";
import { useFetch, type DocItem, type OverviewPayload } from "./lib";
import {
  Award, Copy, CreditCard, ExternalLink, FileText, Pill, Receipt, Send, type LucideIcon,
} from "lucide-react";

const KIND_ICON: Record<string, LucideIcon> = {
  report: FileText, certificate: Award, referral: Send, "implant-card": CreditCard,
  "prescription-print": Pill, "invoice-print": Receipt,
};

function DocCard({ d, onCopy }: { d: DocItem; onCopy: (code: string) => void }) {
  const { t, lang } = useI18n();
  const Icon = KIND_ICON[d.kind] ?? FileText;
  return (
    <li className="grid gap-3 rounded-2xl border p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary" aria-hidden>
            <Icon className="size-4.5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{bi(lang, d.titleAr, d.titleEn)}</p>
            <p className="text-xs text-muted-foreground">{t("pp.doc.issuedAt")}: <span className="font-mono" dir="ltr">{bhDateString(d.issuedAt)}</span></p>
          </div>
        </div>
        <Badge variant="outline" className="shrink-0 text-[10px] text-muted-foreground">{t(`pp.doc.kind.${d.kind}`)}</Badge>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/30 p-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{t("pp.doc.code")}</p>
          <p className="mt-0.5 break-all font-mono text-xs font-semibold" dir="ltr">{d.verifyCode}</p>
          <Button
            variant="outline" size="sm" className="mt-2 min-h-11"
            onClick={() => onCopy(d.verifyCode)} aria-label={t("pp.doc.copy")}
          >
            <Copy className="size-4" aria-hidden />{t("pp.doc.copy")}
          </Button>
        </div>
        <QrCode value={d.verifyCode} size={92} className="border" />
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
      <h1 className="flex items-center gap-2 text-xl font-bold"><FileText className="size-5 text-primary" aria-hidden />{t("pp.doc.title")}</h1>

      {data.loading ? <LoadingRows n={3} h="h-48" /> : data.error ? <ErrorBox error={data.error} onRetry={data.reload} /> : (
        <>
          <SectionCard>
            {docs.length ? (
              <ul className="grid gap-3 lg:grid-cols-2" role="list">
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
