"use client";
/**
 * Consents (الإقرارات) — signed list (status badges + withdraw) and available
 * templates accordion opening the signing dialog. NOTE: withdraw needs the
 * consent id; the list endpoint only returns codes, so ids signed via the
 * portal this session are remembered (sessionStorage) — legacy codes surface
 * the server error (known API gap, logged in worklog).
 */
import { useState } from "react";
import { useI18n, bi } from "@/i18n";
import { apiGet, apiPost } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorBox, LoadingRows, SectionCard } from "./parts";
import { PageHead, StBadge } from "./shell-ui";
import ConsentDialog, { CONSENT_ID_MAP } from "./consent-dialog";
import { errText, useFetch, type ConsentTemplate, type SignedConsent } from "./lib";
import { FileSignature, FileText, PenLine, Undo2 } from "lucide-react";

export default function ConsentsScreen() {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const data = useFetch<{ signed: SignedConsent[]; templates: ConsentTemplate[] }>(() => apiGet("/api/patient/consents"));
  const [signTarget, setSignTarget] = useState<ConsentTemplate | null>(null);
  const [withdrawTarget, setWithdrawTarget] = useState<SignedConsent | null>(null);
  const [busy, setBusy] = useState(false);

  const titleOf = (key: string) => {
    const tpl = (data.data?.templates ?? []).find((x) => x.key === key);
    return tpl ? bi(lang, tpl.titleAr, tpl.titleEn) : key;
  };

  const withdraw = async () => {
    if (!withdrawTarget) return;
    setBusy(true);
    let id = withdrawTarget.code;
    try {
      const m = JSON.parse(sessionStorage.getItem(CONSENT_ID_MAP) ?? "{}") as Record<string, string>;
      id = m[withdrawTarget.code] ?? withdrawTarget.code;
    } catch { /* keep code */ }
    try {
      await apiPost("/api/patient/consents/withdraw", { consentId: id });
      toast({ title: t("pp.con.withdrawn"), description: withdrawTarget.code });
      data.reload();
    } catch (e) {
      toast({ title: t("common.error"), description: errText(e, lang), variant: "destructive" });
    } finally {
      setBusy(false);
      setWithdrawTarget(null);
    }
  };

  return (
    <div className="grid gap-4">
      <PageHead icon={FileSignature} title={t("pp.con.title")} sub={t("pp.con.sub")} />

      {data.loading ? <LoadingRows n={3} h="h-24" /> : data.error ? <ErrorBox error={data.error} onRetry={data.reload} /> : (
        <>
          <SectionCard title={t("pp.con.signed")} icon={FileText} contentClassName="p-0">
            {(data.data?.signed ?? []).length ? (
              <ul className="list-group" role="list">
                {(data.data?.signed ?? []).map((c) => (
                  <li key={c.code} className="list-item">
                    <span className="li-body min-w-0">
                      <span className="li-title truncate">{titleOf(c.templateKey)}</span>
                      <span className="li-sub flex flex-wrap items-center gap-x-2">
                        <span className="mono">{c.code}</span>
                        <span>· {t("pp.con.signedAt")} {c.signedAt}</span>
                        <span>· {t("pp.con.method")}: {c.method}</span>
                      </span>
                    </span>
                    <span className="li-end flex-wrap">
                      <StBadge status={c.status} />
                      {c.status === "active" ? (
                        <Button variant="outline" size="sm" className="min-h-11 text-destructive" onClick={() => setWithdrawTarget(c)}>
                          <Undo2 className="size-4" aria-hidden />{t("pp.con.withdraw")}
                        </Button>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            ) : <EmptyState icon={FileSignature} text={t("pp.con.empty")} />}
          </SectionCard>

          <SectionCard title={t("pp.con.templates")} icon={PenLine}>
            <Accordion type="multiple" className="w-full">
              {(data.data?.templates ?? []).map((tpl) => (
                <AccordionItem key={tpl.key} value={tpl.key}>
                  <AccordionTrigger className="min-h-11 py-3 text-start text-sm font-semibold">
                    <span className="flex flex-wrap items-center gap-2">
                      {bi(lang, tpl.titleAr, tpl.titleEn)}
                      <span className="badge b-slate">{t("pp.con.minRead", { sec: tpl.minReadSec })}</span>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <p className="whitespace-pre-line rounded-lg bg-surface-2 p-3 text-xs leading-6">{bi(lang, tpl.bodyAr, tpl.bodyEn)}</p>
                    <Button size="sm" className="mt-2 min-h-11" onClick={() => setSignTarget(tpl)}>
                      <PenLine className="size-4" aria-hidden />{t("pp.con.sign")}
                    </Button>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </SectionCard>
        </>
      )}

      <ConsentDialog template={signTarget} open={!!signTarget} onOpenChange={(o) => !o && setSignTarget(null)} onSigned={data.reload} />

      <AlertDialog open={!!withdrawTarget} onOpenChange={(o) => !o && setWithdrawTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("pp.con.withdraw")}</AlertDialogTitle>
            <AlertDialogDescription>{t("pp.con.withdrawConfirm")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11" disabled={busy}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction className="min-h-11" onClick={(e) => { e.preventDefault(); void withdraw(); }} disabled={busy}>{t("common.confirm")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
