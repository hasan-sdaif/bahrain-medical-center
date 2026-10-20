"use client";
/**
 * Collector routes tab (S3) — POST home/plan-routes (§17.11 NN + 2-opt +
 * fasting-first) → per-zone cards: collector, ordered stop timeline (seq /
 * addr / fasting / ETA), totalKm, algorithm chip + warnings (SMP_TRANSPORT_LIMIT
 * amber). Per-stop visit progression: في الطريق → وصل → سحب (cold chain +
 * payment dialog) → للمختبر via POST home/visit-status; stops join back to
 * requests by the same addr string the server builds.
 */
import { useMemo, useState } from "react";
import { useI18n } from "@/i18n";
import { apiPost } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import { BHD3, FILS } from "@/lib/money";
import { StatusBadge } from "@/components/shared/badges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, MapPinned, Route, Thermometer, TriangleAlert } from "lucide-react";
import { problemDetail } from "./billing-types";
import type { HomeData, HomeRequest } from "./home-requests";

interface RouteStop { seq: number; addr: string; fasting: boolean; etaMin: number }
interface PlannedRoute { zone: string; collector: { id: string; nameAr: string } | null; order: RouteStop[]; totalKm: number; warnings: string[] }

const FASTING_BADGE = "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300";

/** Same addr string the server composes for a stop — used as the join key. */
const stopAddr = (r: HomeRequest) => `${r.address.area ?? ""} بلوك ${r.address.block ?? ""} — ${r.address.building ?? ""}`;

export function HomeRoutesTab({ data, reload }: { data: HomeData | null; reload: () => Promise<void> | void }) {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const [routes, setRoutes] = useState<PlannedRoute[] | null>(null);
  const [planning, setPlanning] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  // draw ("سحب") progress dialog state
  const [draw, setDraw] = useState<HomeRequest | null>(null);
  const [tempC, setTempC] = useState("4");
  const [method, setMethod] = useState("cash");
  const [amount, setAmount] = useState("");
  const [otp, setOtp] = useState(false);
  const [drawBusy, setDrawBusy] = useState(false);

  const byAddr = useMemo(() => {
    const m = new Map<string, HomeRequest>();
    for (const r of data?.requests ?? []) if (!m.has(stopAddr(r))) m.set(stopAddr(r), r);
    return m;
  }, [data]);

  const plan = async () => {
    setPlanning(true);
    try {
      const r = await apiPost<{ routes: PlannedRoute[]; algorithm: string }>("/api/staff/home/plan-routes", {});
      setRoutes(r.routes);
      await reload();
      toast({ title: t("common.done"), description: t("hc.routes.algorithm", { name: r.algorithm }) });
    } catch (err) {
      toast({ title: t("common.error"), description: problemDetail(err, lang), variant: "destructive" });
    } finally { setPlanning(false); }
  };

  const advance = async (req: HomeRequest, status: string, extra?: Record<string, unknown>): Promise<boolean> => {
    if (!req.visit) return false;
    setBusyId(req.id);
    try {
      await apiPost("/api/staff/home/visit-status", { visitId: req.visit.id, status, ...extra });
      toast({ title: req.code, description: t("hc.visit.updated") });
      await reload();
      return true;
    } catch (err) {
      toast({ title: t("common.error"), description: problemDetail(err, lang), variant: "destructive" });
      return false;
    } finally { setBusyId(null); }
  };

  const openDraw = (req: HomeRequest) => {
    setDraw(req); setTempC("4"); setMethod("cash"); setAmount(BHD3(req.feeFils)); setOtp(false);
  };

  const submitDraw = async () => {
    if (!draw) return;
    setDrawBusy(true);
    const ok = await advance(draw, "drawn", {
      sampleTempC: tempC.trim() === "" ? undefined : Number(tempC),
      paymentMethod: method,
      amountFils: amount.trim() === "" ? undefined : FILS(amount),
      otpShown: otp,
    });
    setDrawBusy(false);
    if (ok) setDraw(null);
  };

  const stopActions = (req: HomeRequest) => {
    if (!req.visit) return <span className="text-xs text-amber-700 dark:text-amber-300">{t("hc.visit.noVisitRecord")}</span>;
    const b = (label: string, onClick: () => void, icon?: React.ReactNode) => (
      <Button size="sm" className="h-8 px-2.5" disabled={busyId === req.id} onClick={onClick}>{icon}{label}</Button>
    );
    switch (req.status) {
      case "confirmed":
      case "assigned":
        return b(t("hc.visit.onTheWay"), () => void advance(req, "on-the-way"));
      case "on-the-way":
        return b(t("hc.visit.arrived"), () => void advance(req, "arrived"));
      case "arrived":
        return b(t("hc.visit.drawn"), () => openDraw(req), <Thermometer className="size-3.5" aria-hidden />);
      case "drawn":
        return b(t("hc.visit.toLab"), () => void advance(req, "to-lab"));
      default:
        return (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="size-3.5" aria-hidden /> {t(`status.${req.status}`)}
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-bold flex items-center gap-2"><Route className="size-5 text-primary" aria-hidden /> {t("hc.tab.routes")}</h2>
        <Button className="ms-auto h-11" disabled={planning} onClick={() => void plan()}>
          <MapPinned aria-hidden /> {planning ? t("hc.routes.planning") : t("hc.routes.plan")}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{t("hc.visit.hint")}</p>

      {(!routes || routes.length === 0) ? (
        <Card>
          <CardContent className="p-8 text-center space-y-1.5">
            <p className="text-sm text-muted-foreground">{t("hc.routes.empty")}</p>
            <p className="text-xs text-muted-foreground">{t("hc.routes.emptyHint")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {routes.map((rt) => (
            <Card key={rt.zone}>
              <CardHeader className="py-4 space-y-1.5">
                <CardTitle className="text-base flex flex-wrap items-center gap-2">
                  <MapPinned className="size-4 text-primary" aria-hidden /> {t(`hc.gov.${rt.zone}`)}
                  <Badge variant="outline" className="font-normal">{t("hc.routes.collector")}: {rt.collector?.nameAr ?? "—"}</Badge>
                </CardTitle>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="outline" className="font-mono text-[10px]">{t("hc.routes.km")}: {rt.totalKm} km</Badge>
                  <Badge variant="outline" className="font-mono text-[10px] border-primary/40 bg-primary/10 text-primary">{t("hc.routes.caption")}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <ol>
                  {rt.order.map((s) => {
                    const req = byAddr.get(s.addr);
                    return (
                      <li key={s.seq} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <span className="grid size-8 shrink-0 place-items-center rounded-full border border-primary/30 bg-primary/10 text-primary font-mono text-xs font-bold">{s.seq}</span>
                          {s.seq < rt.order.length && <span className="w-px flex-1 bg-border min-h-4" aria-hidden />}
                        </div>
                        <div className="flex-1 min-w-0 pb-4 space-y-1.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-sm font-medium break-words">{s.addr}</span>
                            {s.fasting && <Badge variant="outline" className={`${FASTING_BADGE} font-normal`}>{t("hc.req.fasting")}</Badge>}
                            <Badge variant="outline" className="font-mono text-[10px] text-muted-foreground">{t("hc.routes.eta", { min: s.etaMin })}</Badge>
                          </div>
                          {req ? (
                            <div className="flex flex-wrap items-center gap-1.5">
                              <StatusBadge status={req.status} />
                              {stopActions(req)}
                            </div>
                          ) : <span className="text-xs text-muted-foreground">—</span>}
                        </div>
                      </li>
                    );
                  })}
                </ol>
                {rt.warnings.length > 0 && (
                  <div className="space-y-1 rounded-xl border border-amber-500/40 bg-amber-500/10 p-2.5">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-amber-800 dark:text-amber-300">
                      <TriangleAlert className="size-3.5 shrink-0" aria-hidden /> {t("hc.routes.warnings")}
                    </div>
                    {rt.warnings.map((w) => (
                      <p key={w} dir="ltr"
                        className={`text-xs font-mono break-words ${w.startsWith("SMP_") ? "text-amber-800 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-300"}`}>{w}</p>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* سحب العينة — cold chain + payment + barcode verification */}
      <Dialog open={!!draw} onOpenChange={(o) => !o && setDraw(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("hc.visit.drawn")} — {draw?.code}</DialogTitle>
            <DialogDescription>{draw ? `${draw.patient.nameAr} · ${draw.patient.mrn}` : ""}</DialogDescription>
          </DialogHeader>
          {draw && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="temp-c">{t("hc.visit.temp")} · {t("hc.visit.coldChain")}</Label>
                  <Input id="temp-c" inputMode="decimal" value={tempC} onChange={(e) => setTempC(e.target.value)} className="h-11 font-mono" dir="ltr" />
                </div>
                <div className="space-y-1">
                  <Label>{t("hc.visit.payMethod")}</Label>
                  <Select value={method} onValueChange={setMethod}>
                    <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["cash", "card", "benefit"].map((m) => <SelectItem key={m} value={m}>{t(`bc.pay.method.${m}`)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="draw-amount">{t("hc.visit.payAmount")}</Label>
                <Input id="draw-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-11 font-mono" dir="ltr" />
              </div>
              <label htmlFor="otp-shown" className="flex items-start gap-2.5 rounded-lg border p-3 cursor-pointer min-h-11">
                <Checkbox id="otp-shown" checked={otp} onCheckedChange={(v) => setOtp(v === true)} className="mt-0.5" />
                <span className="text-sm">{t("hc.visit.otp")}</span>
              </label>
              <p className="text-xs text-muted-foreground">{t("hc.visit.otpHint")}</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDraw(null)}>{t("common.cancel")}</Button>
            <Button className="h-11" disabled={drawBusy || tempC.trim() === ""} onClick={() => void submitDraw()}>
              {drawBusy ? t("common.loading") : t("common.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
