"use client";
/**
 * العمليات والمرافق (agent 2-f) — sub-tab shell. Tabs mirror the server RBAC
 * matrix so every visible call passes its role gate (src/server/perm.ts).
 */
import { useMemo, useState } from "react";
import { useApp } from "@/store/app";
import { useI18n } from "@/i18n";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { INV_ROLES, HR_ROLES, MAINT_ROLES, QUALITY_ROLES, REPORTS_ROLES } from "./ops-shared";
import AssetsTab from "./ops-assets";
import WorkOrdersTab from "./ops-workorders";
import MetricsTab from "./ops-metrics";
import InventoryTab from "./ops-inventory";
import HrTab from "./ops-hr";
import QualityTab from "./ops-quality";
import ReportsTab from "./ops-reports";

type TabKey = "assets" | "workorders" | "metrics" | "inventory" | "hr" | "quality" | "reports";
type TabDef = readonly [TabKey, Set<string>, string];

const TABS: readonly TabDef[] = [
  ["assets", MAINT_ROLES, "🩻"],
  ["workorders", MAINT_ROLES, "🛠️"],
  ["metrics", MAINT_ROLES, "📊"],
  ["inventory", INV_ROLES, "📦"],
  ["hr", HR_ROLES, "👥"],
  ["quality", QUALITY_ROLES, "🛡️"],
  ["reports", REPORTS_ROLES, "📈"],
];

export default function Ops() {
  const { staff } = useApp();
  const { t } = useI18n();
  const role = staff?.role ?? "";
  const tabs = useMemo<TabKey[]>(() => TABS.filter(([, gate]) => gate.has(role)).map(([key]) => key), [role]);
  const [tab, setTab] = useState<TabKey | null>(null);
  const active = tab && tabs.includes(tab) ? tab : (tabs[0] ?? null);

  if (!active) {
    return (
      <div className="p-6">
        <div className="mx-auto max-w-lg rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          {t("common.empty")} — {t(`staff.role.${role}`)}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4 md:p-6">
      <header className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-bold">{t("staff.module.ops")}</h1>
        <Badge variant="outline" className="font-normal text-muted-foreground">{t(`staff.role.${role}`)}</Badge>
      </header>

      <Tabs value={active} onValueChange={(v) => setTab(v as TabKey)}>
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1">
          {tabs.map((key) => (
            <TabsTrigger key={key} value={key} className="h-9 flex-none px-3">
              <span aria-hidden>{TABS.find(([k]) => k === key)?.[2]}</span>
              {t(`ops.tab.${key}`)}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="assets" className="mt-3"><AssetsTab /></TabsContent>
        <TabsContent value="workorders" className="mt-3"><WorkOrdersTab /></TabsContent>
        <TabsContent value="metrics" className="mt-3"><MetricsTab /></TabsContent>
        <TabsContent value="inventory" className="mt-3"><InventoryTab /></TabsContent>
        <TabsContent value="hr" className="mt-3"><HrTab /></TabsContent>
        <TabsContent value="quality" className="mt-3"><QualityTab /></TabsContent>
        <TabsContent value="reports" className="mt-3"><ReportsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
