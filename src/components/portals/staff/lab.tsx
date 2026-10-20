"use client";
/**
 * المختبر والأشعة (agent 2-d / S1) — sub-tab shell. Tabs mirror the server RBAC
 * matrix so every visible call passes its role gate (src/server/perm.ts).
 */
import { useMemo, useState } from "react";
import { useApp } from "@/store/app";
import { useI18n } from "@/i18n";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Droplet, FlaskConical, Inbox, Ruler, Scan, Siren } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { LAB_ROLES, PHLEB_ROLES, RAD_ROLES } from "./lab-shared";
import PhlebTab from "./lab-phleb";
import ReceiveTab from "./lab-worklist";
import ResultsTab from "./lab-results";
import CriticalTab from "./lab-critical";
import QcTab from "./lab-qc";
import RadTab from "./lab-radiology";

type TabKey = "phleb" | "receive" | "results" | "critical" | "qc" | "rad";
type TabDef = readonly [TabKey, Set<string>, LucideIcon];

const TABS: readonly TabDef[] = [
  ["phleb", PHLEB_ROLES, Droplet],
  ["receive", LAB_ROLES, Inbox],
  ["results", LAB_ROLES, FlaskConical],
  ["critical", LAB_ROLES, Siren],
  ["qc", LAB_ROLES, Ruler],
  ["rad", RAD_ROLES, Scan],
];

export default function Lab() {
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
          {t("lab.noaccess")} — {t(`staff.role.${role}`)}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4 md:p-6">
      <header className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-bold">{t("staff.module.lab")}</h1>
        <Badge variant="outline" className="font-normal text-muted-foreground">{t(`staff.role.${role}`)}</Badge>
        <p className="w-full text-xs text-muted-foreground">{t("lab.subtitle")}</p>
      </header>

      <Tabs value={active} onValueChange={(v) => setTab(v as TabKey)}>
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1">
          {tabs.map((key) => (
            <TabsTrigger key={key} value={key} className="h-9 flex-none gap-1.5 px-3">
              {(() => { const Icon = TABS.find(([k]) => k === key)?.[2]; return Icon ? <Icon aria-hidden className="size-4" /> : null; })()}
              {t(`lab.tab.${key}`)}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="phleb" className="mt-3"><PhlebTab /></TabsContent>
        <TabsContent value="receive" className="mt-3"><ReceiveTab /></TabsContent>
        <TabsContent value="results" className="mt-3"><ResultsTab /></TabsContent>
        <TabsContent value="critical" className="mt-3"><CriticalTab /></TabsContent>
        <TabsContent value="qc" className="mt-3"><QcTab /></TabsContent>
        <TabsContent value="rad" className="mt-3"><RadTab /></TabsContent>
      </Tabs>
    </div>
  );
}
