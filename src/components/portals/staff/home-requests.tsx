"use client";
/**
 * Home draw requests tab (S3) — requests table (code/patient/zone/tests/
 * fasting/slot/fee/status/channel) + confirm action with optional fee
 * override. Also exports the shared HomeData types used by all home-* tabs.
 */
import { useState } from "react";
import { useI18n, bi } from "@/i18n";
import { apiPost } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import { FILS } from "@/lib/money";
import { MoneyText, StatusBadge } from "@/components/shared/badges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarCheck } from "lucide-react";
import { problemDetail } from "./billing-types";

export interface HomeAddress { governorate?: string | null; area?: string | null; block?: string | null; building?: string | null; notes?: string | null }
export interface HomeTest { code: string; nameAr?: string | null; priceFils?: number; fasting?: boolean }
export interface HomeVisitRef { id: string; collectorId: string | null; eta: string | null; status: string }
export interface HomeRequest {
  id: string; code: string; status: string; channel: string; fasting: boolean; slot: string;
  feeFils: number; tests: HomeTest[]; address: HomeAddress; prefGender: string;
  patient: { mrn: string; nameAr: string; phone: string; dob: string };
  visit: HomeVisitRef | null; createdAt: string;
}
export interface HomeZone { id: string; governorate: string; feeFils: number; areas: string[] }
export interface HomeData { zones: HomeZone[]; requests: HomeRequest[] }

const FASTING_BADGE = "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300";

export function HomeRequestsTab({ data, reload }: { data: HomeData | null; reload: () => Promise<void> | void }) {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const [confirming, setConfirming] = useState<HomeRequest | null>(null);
  const [fee, setFee] = useState("");
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    if (!confirming) return;
    setBusy(true);
    try {
      await apiPost("/api/staff/home/confirm", { requestId: confirming.id, ...(fee.trim() ? { feeFils: FILS(fee) } : {}) });
      toast({ title: `✅ ${confirming.code}`, description: t("hc.req.confirmed") });
      setConfirming(null); setFee("");
      await reload();
    } catch (err) {
      toast({ title: t("common.error"), description: problemDetail(err, lang), variant: "destructive" });
    } finally { setBusy(false); }
  };

  if (!data) {
    return <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>;
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border overflow-x-auto max-h-[34rem] overflow-y-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/60 text-xs text-muted-foreground">
              <th className="text-start font-medium px-3 py-2">{t("common.code")}</th>
              <th className="text-start font-medium px-3 py-2">{t("common.name")}</th>
              <th className="text-start font-medium px-3 py-2">{t("hc.req.zone")}</th>
              <th className="text-start font-medium px-3 py-2">{t("hc.req.tests")}</th>
              <th className="text-start font-medium px-3 py-2">{t("hc.req.slot")}</th>
              <th className="text-start font-medium px-3 py-2">{t("hc.req.fee")}</th>
              <th className="text-start font-medium px-3 py-2">{t("common.status")}</th>
              <th className="text-start font-medium px-3 py-2">{t("hc.req.channel")}</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {data.requests.map((r) => (
              <tr key={r.id} className="border-t hover:bg-muted/30 align-top">
                <td className="px-3 py-2.5 font-mono text-xs whitespace-nowrap">{r.code}</td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <div className="font-medium">{r.patient.nameAr}</div>
                  <div className="text-xs text-muted-foreground font-mono">{r.patient.mrn}</div>
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <div>{t(`hc.gov.${r.address.governorate ?? "capital"}`)}</div>
                  {r.address.area && <div className="text-xs text-muted-foreground">{r.address.area}</div>}
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex flex-wrap gap-1 max-w-44">
                    {r.fasting && <Badge variant="outline" className={`${FASTING_BADGE} font-normal`}>{t("hc.req.fasting")}</Badge>}
                    {r.tests.map((td) => (
                      <Badge key={td.code} variant="outline" className="font-normal">{bi(lang, td.nameAr, td.nameAr)}</Badge>
                    ))}
                  </div>
                </td>
                <td className="px-3 py-2.5 text-xs whitespace-nowrap">{r.slot}</td>
                <td className="px-3 py-2.5"><MoneyText fils={r.feeFils} /></td>
                <td className="px-3 py-2.5"><StatusBadge status={r.status} /></td>
                <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{r.channel}</td>
                <td className="px-3 py-2.5 text-end">
                  {r.status === "requested" && (
                    <Button size="sm" className="h-9" onClick={() => { setConfirming(r); setFee(""); }}>
                      <CalendarCheck aria-hidden /> {t("hc.req.confirm")}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
            {data.requests.length === 0 && (
              <tr><td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">{t("common.empty")}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={!!confirming} onOpenChange={(o) => !o && setConfirming(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("hc.req.confirm")} — {confirming?.code}</DialogTitle>
            <DialogDescription>{confirming ? `${confirming.patient.nameAr} · ${confirming.slot}` : ""}</DialogDescription>
          </DialogHeader>
          {confirming && (
            <div className="space-y-3">
              <div className="flex justify-between rounded-lg bg-muted/60 px-3 py-2 text-sm">
                <span className="text-muted-foreground">{t("hc.req.fee")}</span>
                <MoneyText fils={confirming.feeFils} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="fee-override">{t("hc.req.feeOverride")}</Label>
                <Input id="fee-override" inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)}
                  placeholder="3.000" className="h-11 font-mono" dir="ltr" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirming(null)}>{t("common.cancel")}</Button>
            <Button className="h-11" disabled={busy} onClick={() => void confirm()}>{busy ? t("common.loading") : t("common.confirm")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
