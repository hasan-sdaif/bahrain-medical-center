"use client";
/** Assets tab — barcode-first open, grid of asset cards, asset-file drawer. */
import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useI18n, bi } from "@/i18n";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Code128 } from "@/components/shared/barcode";
import { MoneyText, StatusBadge } from "@/components/shared/badges";
import { Printer, ScanLine, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { Countdown, Panel, daysUntil, useOps, type AssetRow, type AssetsResp, type FaultResp, type PlanRow } from "./ops-shared";
import { FaultDialog, FaultSuccess } from "./ops-fault";

/** best-effort PM-plan link: significant name tokens inside the plan title (API returns no pmPlanId). */
function matchPlan(asset: AssetRow, plans: PlanRow[]): PlanRow | null {
  const norm = (s: string) => s.replace(/[\u064B-\u0652]/g, "").toLowerCase();
  const toks = (s: string) => norm(s).split(/\s+/).filter((w) => w.length >= 4);
  const ar = toks(asset.nameAr ?? "");
  const en = toks(asset.nameEn ?? "");
  for (const p of plans) {
    const t = `${p.titleAr ?? ""} ${p.titleEn ?? ""}`;
    if (ar.some((w) => t.includes(w)) || en.some((w) => t.includes(w))) return p;
  }
  return null;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b py-1.5 text-sm last:border-0">
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className="text-end">{children}</span>
    </div>
  );
}

export default function AssetsTab() {
  const { t, lang, dir } = useI18n();
  const { toast } = useToast();
  const { data, loading, error, reload } = useOps<AssetsResp>("/api/staff/maintenance/assets");
  const [scan, setScan] = useState("");
  const [hit, setHit] = useState<string | null>(null);
  const [openCode, setOpenCode] = useState<string | null>(null);
  const [faultOpen, setFaultOpen] = useState(false);
  const [fr, setFr] = useState<FaultResp | null>(null);
  const refs = useRef<Record<string, HTMLDivElement | null>>({});
  const assets = data?.assets ?? [];
  const asset = assets.find((a) => a.code === openCode) ?? null;

  const openByCode = (code: string) => {
    const a = assets.find((x) => x.code.toLowerCase() === code.trim().toLowerCase());
    if (!a) {
      toast({ title: t("ops.assets.notfound"), description: code.trim(), variant: "destructive" });
      return;
    }
    setHit(a.code);
    setOpenCode(a.code);
    setFr(null);
    requestAnimationFrame(() => refs.current[a.code]?.scrollIntoView({ behavior: "smooth", block: "center" }));
    setTimeout(() => setHit((h) => (h === a.code ? null : h)), 4000);
  };

  return (
    <div className="space-y-4">
      <form
        className="flex max-w-md gap-2"
        onSubmit={(e) => { e.preventDefault(); openByCode(scan); setScan(""); }}
      >
        <Input value={scan} onChange={(e) => setScan(e.target.value)} placeholder={t("ops.assets.scan.ph")}
          aria-label={t("ops.assets.scan")} className="h-11 font-mono" />
        <Button type="submit" className="h-11 shrink-0"><ScanLine className="size-4" />{t("ops.assets.scan")}</Button>
      </form>

      <Panel loading={loading} error={error} onRetry={reload} isEmpty={assets.length === 0} rows={5}>
        <p className="text-xs text-muted-foreground">{t("ops.assets.count", { n: assets.length })}</p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {assets.map((a) => (
            <div
              key={a.id}
              ref={(el) => { refs.current[a.code] = el; }}
              role="button" tabIndex={0}
              onClick={() => { setOpenCode(a.code); setFr(null); }}
              onKeyDown={(e: KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpenCode(a.code); setFr(null); } }}
              className={cn("cursor-pointer rounded-xl border bg-card p-4 text-start shadow-sm transition-all hover:shadow-md focus-visible:outline-2 focus-visible:outline-primary",
                hit === a.code && "ring-2 ring-primary ring-offset-2 ring-offset-background")}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-mono text-[11px] text-muted-foreground">{a.code}</div>
                  <div className="truncate text-sm font-semibold">{bi(lang, a.nameAr, a.nameEn)}</div>
                </div>
                <StatusBadge status={a.status} />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <Badge variant="secondary" className="text-[10px]">{t(`ops.cat.${a.category}`)}</Badge>
                {a.calibrationDueAt ? (
                  <Badge variant="outline" className="gap-1 text-[10px] font-normal">
                    {t("ops.assets.calib")} <Countdown days={daysUntil(a.calibrationDueAt)} warn={30} danger={7} />
                  </Badge>
                ) : null}
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                {a.costFils != null ? <MoneyText fils={a.costFils} /> : <span>—</span>}
                {a.warrantyUntil ? <span>{t("ops.assets.warranty")} {a.warrantyUntil}</span> : null}
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Sheet open={!!asset} onOpenChange={(o) => !o && setOpenCode(null)}>
        <SheetContent side={dir === "rtl" ? "left" : "right"} className="w-full gap-0 overflow-y-auto p-0 sm:max-w-md">
          {asset ? (
            <>
              <SheetHeader className="border-b text-start">
                <SheetTitle className="flex flex-wrap items-center gap-2">
                  {bi(lang, asset.nameAr, asset.nameEn)}
                  <StatusBadge status={asset.status} />
                </SheetTitle>
                <SheetDescription>
                  <span className="font-mono">{asset.code}</span> · {t(`ops.cat.${asset.category}`)}
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-4 p-4">
                {fr ? <div className="no-print"><FaultSuccess fr={fr} /></div> : null}
                <Card className="no-print p-0">
                  <CardContent className="p-4">
                    <h3 className="mb-1 text-sm font-semibold">{t("ops.assets.file")}</h3>
                    <Row label={t("ops.assets.serial")}><span className="font-mono text-xs">{asset.serialNo ?? "—"}</span></Row>
                    <Row label={t("ops.assets.model")}><span className="font-mono text-xs">{asset.model ?? "—"}</span></Row>
                    <Row label={t("ops.assets.cost")}><MoneyText fils={asset.costFils} /></Row>
                    <Row label={t("ops.assets.warranty")}>
                      <span className="font-mono text-xs">{asset.warrantyUntil ?? "—"}</span>
                    </Row>
                    <Row label={t("ops.assets.calib")}>
                      {asset.calibrationDueAt
                        ? <span className="inline-flex items-center gap-2 font-mono text-xs">{asset.calibrationDueAt} <Countdown days={daysUntil(asset.calibrationDueAt)} warn={30} danger={7} /></span>
                        : <span className="text-xs text-muted-foreground">{t("ops.assets.calib.none")}</span>}
                    </Row>
                    <Row label={t("ops.assets.downtime")}>
                      <span className="font-mono text-xs tabular-nums">{asset.downtimeMin ?? 0} {t("ops.min.short")}</span>
                    </Row>
                  </CardContent>
                </Card>

                <Card className="no-print p-0">
                  <CardContent className="p-4">
                    <h3 className="mb-1 text-sm font-semibold">{t("ops.assets.pm")}</h3>
                    {(() => {
                      const plan = matchPlan(asset, data?.plans ?? []);
                      if (!plan) return <p className="text-xs text-muted-foreground">{t("ops.assets.pm.none")}</p>;
                      return (
                        <div className="space-y-1.5">
                          <div className="text-sm font-medium">{bi(lang, plan.titleAr, plan.titleEn)}</div>
                          <p className="text-xs text-muted-foreground">{t("ops.assets.pm.every", { n: plan.frequencyDays, m: plan.estMinutes })}</p>
                          {plan.parts?.length ? (
                            <p className="flex flex-wrap items-center gap-1.5 text-xs">
                              {t("ops.assets.pm.parts")}:
                              {plan.parts.map((p) => <Badge key={p.code} variant="outline" className="font-mono text-[10px]">{p.code} ×{p.qty}</Badge>)}
                            </p>
                          ) : null}
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>

                <div className="print-area rounded-xl border p-4">
                  <p className="mb-2 text-center text-xs text-muted-foreground">{t("ops.assets.label")}</p>
                  <Code128 value={asset.code} height={48} />
                  <p className="mt-1 text-center text-xs font-semibold">{bi(lang, asset.nameAr, asset.nameEn)}</p>
                </div>
                <div className="no-print grid grid-cols-2 gap-2">
                  <Button variant="outline" className="h-11" onClick={() => window.print()}>
                    <Printer className="size-4" />{t("common.print")}
                  </Button>
                  <Button className="h-11" onClick={() => setFaultOpen(true)}>
                    <Wrench className="size-4" />{t("ops.assets.report")}
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      {asset ? (
        <FaultDialog
          asset={asset}
          open={faultOpen}
          onOpenChange={setFaultOpen}
          onDone={(res) => { setFr(res); reload(); }}
        />
      ) : null}
    </div>
  );
}
