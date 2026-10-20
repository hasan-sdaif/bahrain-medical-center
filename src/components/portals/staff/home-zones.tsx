"use client";
/**
 * Coverage & pricing tab (S3) — zone cards grid (governorate, areas chips,
 * fee grid). Base feeFils + areas come from GET home/requests; the surcharge
 * schedule (morning/evening/holiday/minimum) mirrors the seeded CoverageZone
 * rows — the list endpoint only returns base fee + areas.
 */
import { useI18n } from "@/i18n";
import { MoneyText } from "@/components/shared/badges";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin } from "lucide-react";
import type { HomeData } from "./home-requests";

const ZONE_SCHEDULE: Record<string, { morningFils: number; eveningFils: number; holidayFils: number; minOrderFils: number }> = {
  capital: { morningFils: 0, eveningFils: 1500, holidayFils: 4000, minOrderFils: 15000 },
  muharraq: { morningFils: 0, eveningFils: 1500, holidayFils: 4500, minOrderFils: 15000 },
  northern: { morningFils: 0, eveningFils: 2000, holidayFils: 5500, minOrderFils: 15000 },
  southern: { morningFils: 0, eveningFils: 2000, holidayFils: 6000, minOrderFils: 15000 },
};

function FeeRow({ label, fils }: { label: string; fils: number | null }) {
  return (
    <div className={`flex justify-between gap-2 rounded-lg px-3 py-2 ${fils != null && fils > 0 ? "bg-muted/60" : ""}`}>
      <span className="text-muted-foreground">{label}</span>
      {fils != null ? <MoneyText fils={fils} /> : <span className="font-mono">—</span>}
    </div>
  );
}

export function HomeZonesTab({ data }: { data: HomeData | null }) {
  const { t } = useI18n();

  if (!data) {
    return <div className="grid gap-3 md:grid-cols-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-52" />)}</div>;
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">ℹ️ {t("hc.zones.note")}</p>
      <div className="grid gap-3 md:grid-cols-2">
        {data.zones.map((z) => {
          const sched = ZONE_SCHEDULE[z.governorate];
          return (
            <Card key={z.id}>
              <CardHeader className="py-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <MapPin className="size-4 text-primary" aria-hidden /> {t(`hc.gov.${z.governorate}`)}
                  <span className="ms-auto font-mono text-[10px] text-muted-foreground">{z.governorate}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-1" aria-label={t("hc.zones.areas")}>
                  {z.areas.map((a) => <Badge key={a} variant="outline" className="font-normal">{a}</Badge>)}
                </div>
                <div className="grid grid-cols-2 gap-1.5 text-sm">
                  <FeeRow label={t("hc.zones.fee")} fils={z.feeFils} />
                  <FeeRow label={t("hc.zones.morning")} fils={sched?.morningFils ?? null} />
                  <FeeRow label={t("hc.zones.evening")} fils={sched?.eveningFils ?? null} />
                  <FeeRow label={t("hc.zones.holiday")} fils={sched?.holidayFils ?? null} />
                  <div className="col-span-2 flex justify-between gap-2 rounded-lg bg-primary/10 px-3 py-2 font-semibold">
                    <span>{t("hc.zones.min")}</span>
                    {sched ? <MoneyText fils={sched.minOrderFils} /> : <span className="font-mono">—</span>}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {data.zones.length === 0 && (
          <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">{t("common.empty")}</CardContent></Card>
        )}
      </div>
    </div>
  );
}
