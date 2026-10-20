"use client";
/**
 * Cashier shifts tab (agent 2-e) — open shift (openingFils) → live session
 * payments summary → close (countedFils) → variance result (expected/counted/
 * difference ± colored + per-method breakdown donut).
 */
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/i18n";
import { useApp } from "@/store/app";
import { apiPost } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import { BHD3, FILS } from "@/lib/money";
import { bhTimeString } from "@/lib/bahrain";
import { MoneyText } from "@/components/shared/badges";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Lock, LockOpen, Wallet, TriangleAlert, BadgeCheck } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { problemDetail, type CloseShiftResult, type SessionPayment } from "./billing-types";

interface ShiftState { id: string; openingFils: number; openedAt: string }
const METHOD_COLORS: Record<string, string> = { cash: "#0d9488", card: "#059669", benefit: "#d97706" };

export function ShiftsTab({ payments }: { payments: SessionPayment[] }) {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const staff = useApp((s) => s.staff);
  const storeKey = `bmc-shift-${staff?.employeeId ?? "anon"}`;
  const [shift, setShift] = useState<ShiftState | null>(null);
  const [result, setResult] = useState<CloseShiftResult | null>(null);
  const [opening, setOpening] = useState("");
  const [counted, setCounted] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storeKey);
      if (raw) setShift(JSON.parse(raw) as ShiftState);
    } catch { /* ignore */ }
  }, [storeKey]);

  const save = (s: ShiftState | null) => {
    setShift(s);
    try {
      if (s) localStorage.setItem(storeKey, JSON.stringify(s));
      else localStorage.removeItem(storeKey);
    } catch { /* ignore */ }
  };

  const sinceOpen = useMemo(
    () => shift ? payments.filter((p) => new Date(p.at).getTime() >= new Date(shift.openedAt).getTime()) : [],
    [payments, shift],
  );
  const totals = useMemo(() => {
    const byMethod: Record<string, number> = {};
    for (const p of sinceOpen) byMethod[p.method] = (byMethod[p.method] ?? 0) + p.amountFils;
    const collected = sinceOpen.reduce((a, p) => a + p.amountFils, 0);
    return { byMethod, collected, expected: collected + (shift?.openingFils ?? 0) };
  }, [sinceOpen, shift]);

  const open = async () => {
    setBusy(true);
    try {
      const r = await apiPost<{ id: string }>("/api/staff/shifts/open", { openingFils: FILS(opening) });
      save({ id: r.id, openingFils: FILS(opening), openedAt: new Date().toISOString() });
      setResult(null); setOpening("");
      toast({ title: "✅", description: t("bc.shift.openBtn") });
    } catch (err) { toast({ title: t("common.error"), description: problemDetail(err, lang), variant: "destructive" }); }
    finally { setBusy(false); }
  };

  const close = async () => {
    if (!shift) return;
    setBusy(true);
    try {
      const r = await apiPost<CloseShiftResult>("/api/staff/shifts/close", { shiftId: shift.id, countedFils: FILS(counted) });
      setResult(r); save(null); setCounted("");
      toast({ title: "✅", description: t("bc.shift.result") });
    } catch (err) { toast({ title: t("common.error"), description: problemDetail(err, lang), variant: "destructive" }); }
    finally { setBusy(false); }
  };

  const donut = Object.entries(result?.methods ?? totals.byMethod).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }));

  return (
    <div className="space-y-4">
      {!shift && !result && (
        <Card>
          <CardHeader className="py-4"><CardTitle className="text-base flex items-center gap-2"><LockOpen className="size-4 text-primary" aria-hidden /> {t("bc.shift.none")}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">{t("bc.shift.demoNote")}</p>
            <Dialog>
              <DialogTrigger asChild><Button className="h-11"><Wallet aria-hidden /> {t("bc.shift.openBtn")}</Button></DialogTrigger>
              <DialogContent className="max-w-sm">
                <DialogHeader><DialogTitle>{t("bc.shift.openTitle")}</DialogTitle><DialogDescription>{t("bc.shift.opening")}</DialogDescription></DialogHeader>
                <div className="space-y-1">
                  <Label htmlFor="opening-fils">{t("bc.shift.opening")}</Label>
                  <Input id="opening-fils" inputMode="decimal" value={opening} onChange={(e) => setOpening(e.target.value)} placeholder="10.000" className="h-11 font-mono" dir="ltr" />
                </div>
                <DialogFooter><Button className="w-full h-11" disabled={busy || !opening.trim()} onClick={open}>{t("bc.shift.openBtn")}</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      )}

      {shift && (
        <Card>
          <CardHeader className="py-4">
            <CardTitle className="text-base flex items-center gap-2"><Wallet className="size-4 text-primary" aria-hidden /> {t("bc.shift.card")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
              <div className="rounded-lg bg-muted/60 px-3 py-2"><div className="text-xs text-muted-foreground">{t("bc.shift.openedAt")}</div><div className="font-mono">{bhTimeString(shift.openedAt)}</div></div>
              <div className="rounded-lg bg-muted/60 px-3 py-2"><div className="text-xs text-muted-foreground">{t("bc.shift.opening")}</div><MoneyText fils={shift.openingFils} /></div>
              <div className="rounded-lg bg-muted/60 px-3 py-2"><div className="text-xs text-muted-foreground">{t("bc.shift.payments")}</div><span className="font-mono">{sinceOpen.length}</span></div>
              <div className="rounded-lg bg-primary/10 px-3 py-2 font-semibold"><div className="text-xs text-muted-foreground">{t("bc.shift.expected")}</div><MoneyText fils={totals.expected} /></div>
            </div>
            {sinceOpen.length > 0 && (
              <div className="rounded-xl border divide-y max-h-48 overflow-y-auto">
                {sinceOpen.map((p) => (
                  <div key={p.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                    <span className="font-mono text-xs">{p.code}</span>
                    <span className="text-xs text-muted-foreground">{p.invoiceCode}</span>
                    <span className="text-xs">{t(`bc.pay.method.${p.method}`)}</span>
                    <MoneyText fils={p.amountFils} className="ms-auto" />
                  </div>
                ))}
              </div>
            )}
            <Dialog>
              <DialogTrigger asChild><Button variant="destructive" className="h-11"><Lock aria-hidden /> {t("bc.shift.closeBtn")}</Button></DialogTrigger>
              <DialogContent className="max-w-sm">
                <DialogHeader><DialogTitle>{t("bc.shift.closeBtn")}</DialogTitle><DialogDescription>{t("bc.shift.countedHint")}</DialogDescription></DialogHeader>
                <div className="space-y-1">
                  <Label htmlFor="counted-fils">{t("bc.shift.counted")}</Label>
                  <Input id="counted-fils" inputMode="decimal" value={counted} onChange={(e) => setCounted(e.target.value)} placeholder={BHD3(totals.expected)} className="h-11 font-mono" dir="ltr" />
                </div>
                <DialogFooter><Button className="w-full h-11" disabled={busy || !counted.trim()} onClick={close}>{t("bc.shift.closeBtn")}</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card>
          <CardHeader className="py-4"><CardTitle className="text-base flex items-center gap-2"><BadgeCheck className="size-4 text-primary" aria-hidden /> {t("bc.shift.result")}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl border p-3"><div className="text-xs text-muted-foreground mb-1">{t("bc.shift.expected")}</div><MoneyText fils={result.expectedFils} className="text-base font-semibold" /></div>
              <div className="rounded-xl border p-3"><div className="text-xs text-muted-foreground mb-1">{t("bc.shift.counted")}</div><MoneyText fils={result.countedFils} className="text-base font-semibold" /></div>
              <div className={`rounded-xl p-3 border ${result.difference === 0 ? "border-emerald-500/50 bg-emerald-500/10" : result.difference < 0 ? "border-rose-500/50 bg-rose-500/10" : "border-amber-500/50 bg-amber-500/10"}`}>
                <div className="text-xs text-muted-foreground mb-1">{t("bc.shift.diff")}</div>
                <div className={`font-mono text-base font-bold ${result.difference === 0 ? "text-emerald-600" : result.difference < 0 ? "text-rose-600" : "text-amber-600"}`} dir="ltr">{BHD3(result.difference)}</div>
              </div>
            </div>
            <div role="status" className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium ${result.difference === 0 ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : result.difference < 0 ? "border-rose-500/50 bg-rose-500/10 text-rose-700 dark:text-rose-300" : "border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-300"}`}>
              {result.difference !== 0 && <TriangleAlert className="size-4 shrink-0" aria-hidden />}
              <span>{result.difference === 0 ? t("bc.shift.balanced") : result.difference < 0 ? `${t("bc.shift.short")} (${BHD3(result.difference)})` : `${t("bc.shift.over")} (+${BHD3(result.difference)})`}</span>
            </div>
            {donut.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="h-36 w-36 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={donut} dataKey="value" nameKey="name" innerRadius={38} outerRadius={62} paddingAngle={3} strokeWidth={0}>
                        {donut.map((d) => <Cell key={d.name} fill={METHOD_COLORS[d.name] ?? "#52525b"} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => BHD3(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-1.5 w-full">
                  <div className="text-sm font-medium flex items-center gap-2"><Separator className="w-1 h-4 bg-primary" /> {t("bc.shift.methods")}</div>
                  {donut.map((d) => (
                    <div key={d.name} className="flex items-center gap-2 text-sm">
                      <span className="size-2.5 rounded-full" style={{ background: METHOD_COLORS[d.name] ?? "#52525b" }} aria-hidden />
                      <span>{t(`bc.pay.method.${d.name}`)}</span>
                      <MoneyText fils={d.value} className="ms-auto" />
                    </div>
                  ))}
                </div>
              </div>
            )}
            <Button variant="outline" className="h-11" onClick={() => setResult(null)}><LockOpen aria-hidden /> {t("bc.shift.closedNew")}</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
