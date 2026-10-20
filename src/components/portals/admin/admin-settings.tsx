"use client";
/**
 * Tab 3 — الإعدادات: GET /api/staff/settings/list — settings grouped by group
 * (key / JSON preview / version), read-only feature flags (changes require the
 * admin API with dual authorization), number sequences (never reused) and
 * facility licenses with countdown badges.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useI18n } from "@/i18n";
import { apiGet } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Award, BadgeCheck, Flag, Hash, Settings2 } from "lucide-react";
import { ErrCard, Section, jsonPreview, type SettingsResp } from "./bits";

function DaysBadge({ days }: { days: number }) {
  const { t } = useI18n();
  const tone = days > 90
    ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
    : days > 30
      ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
      : "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200";
  return <Badge className={cn("border-transparent tabular-nums", tone)}>{t("admin.settings.licenses.days", { n: days })}</Badge>;
}

export default function AdminSettings() {
  const { t } = useI18n();
  const [data, setData] = useState<SettingsResp | null>(null);
  const [err, setErr] = useState<unknown>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      setData(await apiGet<SettingsResp>("/api/staff/settings/list"));
    } catch (e) {
      setErr(e);
    }
  }, []);

  useEffect(() => { queueMicrotask(() => void load()); }, [load]);

  const groups = useMemo(() => {
    const g = new Map<string, SettingsResp["settings"]>();
    for (const s of data?.settings ?? []) {
      const list = g.get(s.group) ?? [];
      list.push(s);
      g.set(s.group, list);
    }
    return [...g.entries()];
  }, [data]);

  if (err && !data) return <Section title={t("admin.tab.settings")}><ErrCard err={err} onRetry={() => void load()} /></Section>;
  if (!data) {
    return (
      <Section title={t("admin.tab.settings")}>
        <Skeleton className="h-16" />
        <Skeleton className="h-64" />
        <div className="grid gap-4 md:grid-cols-2"><Skeleton className="h-48" /><Skeleton className="h-48" /></div>
      </Section>
    );
  }

  return (
    <Section title={t("admin.tab.settings")} sub={t("admin.settings.sub")}>
      <TooltipProvider delayDuration={100}>
        <Card className="p-0">
          <CardHeader className="py-3 px-4 bg-muted/50">
            <CardTitle className="text-sm flex items-center gap-2"><Settings2 className="size-4 text-primary" aria-hidden /> {t("admin.settings.col.key")} / {t("admin.settings.col.value")}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 grid gap-5">
            {groups.map(([group, items]) => (
              <div key={group}>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="font-mono text-[10px]">{group}</Badge>
                  <span className="text-xs text-muted-foreground">{t("common.total")}: {items.length}</span>
                </div>
                <div className="rounded-lg border max-h-64 overflow-y-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                      <TableRow>
                        <TableHead className="text-start">{t("admin.settings.col.key")}</TableHead>
                        <TableHead className="text-start">{t("admin.settings.col.value")}</TableHead>
                        <TableHead className="text-start">{t("admin.settings.col.version")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((s) => (
                        <TableRow key={s.key}>
                          <TableCell className="font-mono text-xs" dir="ltr">{s.key}</TableCell>
                          <TableCell className="font-mono text-xs max-w-64" dir="ltr" title={typeof s.value === "string" ? s.value : JSON.stringify(s.value)}>
                            <div className="truncate">{jsonPreview(s.value)}</div>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground tabular-nums">v{s.version}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="p-0">
            <CardHeader className="py-3 px-4 bg-muted/50">
              <CardTitle className="text-sm flex items-center gap-2"><Flag className="size-4 text-primary" aria-hidden /> {t("admin.settings.flags")}</CardTitle>
            </CardHeader>
            <CardContent className="p-4 grid gap-3 max-h-96 overflow-y-auto">
              {data.flags.map((f) => (
                <div key={f.key} className="flex items-center gap-3 rounded-lg border p-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-xs" dir="ltr">{f.key}</div>
                    <div className="text-xs text-muted-foreground truncate">{f.description ?? "—"}</div>
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground hidden sm:block">{f.enabled ? t("admin.settings.flags.on") : t("admin.settings.flags.off")}</span>
                        <Switch checked={f.enabled} disabled aria-label={f.key} />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top">{t("admin.settings.flags.hint")}</TooltipContent>
                  </Tooltip>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="p-0">
            <CardHeader className="py-3 px-4 bg-muted/50">
              <CardTitle className="text-sm flex items-center gap-2"><Hash className="size-4 text-primary" aria-hidden /> {t("admin.settings.sequences")}</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <Badge variant="outline" className="mb-3 bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 border-transparent">{t("admin.settings.sequences.note")}</Badge>
              <div className="max-h-64 overflow-y-auto rounded-lg border">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead className="text-start">{t("admin.settings.col.key")}</TableHead>
                      <TableHead className="text-start">{t("admin.settings.sequences.next")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.sequences.map((s) => (
                      <TableRow key={s.key}>
                        <TableCell className="font-mono text-xs" dir="ltr">{s.key}</TableCell>
                        <TableCell className="font-mono text-xs tabular-nums" dir="ltr">{s.next}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="p-0">
          <CardHeader className="py-3 px-4 bg-muted/50">
            <CardTitle className="text-sm flex items-center gap-2"><Award className="size-4 text-primary" aria-hidden /> {t("admin.settings.licenses")}</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.licenses.map((l) => (
                <div key={l.number} className="rounded-lg border p-3 flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{l.nameAr}</div>
                      <div className="font-mono text-[10px] text-muted-foreground" dir="ltr">{l.number}</div>
                    </div>
                    <Badge variant="outline" className="font-mono text-[9px] shrink-0">{l.kind}</Badge>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span className="font-mono" dir="ltr"><span className="sr-only">{t("admin.settings.licenses.expires")}: </span>{l.expiresAt}</span>
                    <DaysBadge days={l.daysLeft} />
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground mt-3 flex items-center gap-1.5">
              <BadgeCheck className="size-3.5 shrink-0" aria-hidden /> {t("admin.sec.nhra.desc")}
            </p>
          </CardContent>
        </Card>
      </TooltipProvider>
    </Section>
  );
}
