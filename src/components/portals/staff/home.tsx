"use client";
/**
 * السحب المنزلي (S3) — field-ops shell: طلبات السحب / مسارات الفنيين /
 * مناطق التغطية. Owns the shared GET home/requests load ({zones, requests})
 * and passes it + reload() to the tab panes (home-requests / home-routes /
 * home-zones) so confirm / plan-routes / visit-status refresh everywhere.
 */
import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/store/app";
import { useI18n } from "@/i18n";
import { apiGet } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClipboardList, MapPin, Route, XCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { problemDetail } from "./billing-types";
import { HomeRequestsTab, type HomeData } from "./home-requests";
import { HomeRoutesTab } from "./home-routes";
import { HomeZonesTab } from "./home-zones";

type TabKey = "requests" | "routes" | "zones";
const TABS: readonly { key: TabKey; icon: LucideIcon }[] = [
  { key: "requests", icon: ClipboardList },
  { key: "routes", icon: Route },
  { key: "zones", icon: MapPin },
];

export default function HomeCare() {
  const { staff } = useApp();
  const { t, lang } = useI18n();
  const [tab, setTab] = useState<TabKey>("requests");
  const [data, setData] = useState<HomeData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((x) => x + 1), []);

  useEffect(() => {
    const ctrl = new AbortController();
    apiGet<HomeData>("/api/staff/home/requests", ctrl.signal)
      .then((d) => { if (!ctrl.signal.aborted) { setData(d); setError(null); } })
      .catch((err) => { if (!ctrl.signal.aborted) { setData(null); setError(problemDetail(err, lang) || t("common.error")); } });
    return () => ctrl.abort();
  }, [tick, lang, t]);

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4 md:p-6">
      <header className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-bold">{t("hc.title")}</h1>
        <Badge variant="outline" className="font-normal text-muted-foreground">{t(`staff.role.${staff?.role ?? ""}`)}</Badge>
      </header>
      <p className="text-sm text-muted-foreground">{t("hc.subtitle")}</p>

      {error ? (
        <Card>
          <CardContent className="p-4 flex flex-wrap items-center gap-3">
            <XCircle className="size-5 text-destructive shrink-0" aria-hidden />
            <span className="text-sm min-w-0 break-words">{error}</span>
            <Button variant="outline" size="sm" className="ms-auto h-9" onClick={reload}>{t("common.retry")}</Button>
          </CardContent>
        </Card>
      ) : (
        <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
          <TabsList className="h-auto w-full flex-wrap justify-start gap-1">
            {TABS.map(({ key, icon: Icon }) => (
              <TabsTrigger key={key} value={key} className="h-9 flex-none gap-1.5 px-3">
                <Icon aria-hidden className="size-4" />
                {t(`hc.tab.${key}`)}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value="requests" className="mt-3"><HomeRequestsTab data={data} reload={reload} /></TabsContent>
          <TabsContent value="routes" className="mt-3"><HomeRoutesTab data={data} reload={reload} /></TabsContent>
          <TabsContent value="zones" className="mt-3"><HomeZonesTab data={data} /></TabsContent>
        </Tabs>
      )}
    </div>
  );
}
