"use client";
/**
 * Section 3 — الإعدادات (Shamel guide admin pattern): GET
 * /api/staff/settings/list — settings grouped by group (key / JSON preview /
 * version), read-only feature flags (changes require the admin API with dual
 * authorization), number sequences (never reused) and facility licenses with
 * countdown badges. Shamel .card / .table styling.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useI18n } from "@/i18n";
import { apiGet } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Award, BadgeCheck, Flag, Hash, Settings2 } from "lucide-react";
import { ErrCard, jsonPreview, type SettingsResp } from "./bits";

function DaysBadge({ days }: { days: number }) {
  const { t } = useI18n();
  const tone = days > 90 ? "b-green" : days > 30 ? "b-amber" : "b-red";
  return <Badge className={cn("tabular-nums", tone)}>{t("admin.settings.licenses.days", { n: days })}</Badge>;
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

  if (err && !data) return <ErrCard err={err} onRetry={() => void load()} />;
  if (!data) {
    return (
      <div className="grid gap-5">
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-64 rounded-2xl" />
        <div className="grid gap-4 lg:grid-cols-2"><Skeleton className="h-48 rounded-2xl" /><Skeleton className="h-48 rounded-2xl" /></div>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={100}>
      <div className="stack-sm">
        <div className="card p-0">
          <div className="card-head">
            <span className="ch-title">
              <span className="ch-ic"><Settings2 className="size-4" aria-hidden /></span>
              {t("admin.settings.col.key")} / {t("admin.settings.col.value")}
            </span>
          </div>
          <div className="card-body grid gap-5">
            {groups.map(([group, items]) => (
              <div key={group}>
                <div className="mb-2 flex items-center gap-2">
                  <Badge variant="outline" className="mono text-[10px]">{group}</Badge>
                  <span className="text-xs text-ink-3">{t("common.total")}: {items.length}</span>
                </div>
                <div className="table-wrap max-h-64 overflow-y-auto rounded-lg border">
                  <table className="table sm">
                    <thead>
                      <tr>
                        <th>{t("admin.settings.col.key")}</th>
                        <th>{t("admin.settings.col.value")}</th>
                        <th>{t("admin.settings.col.version")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((s) => (
                        <tr key={s.key}>
                          <td className="mono text-xs" dir="ltr">{s.key}</td>
                          <td className="mono max-w-64 text-xs" dir="ltr" title={typeof s.value === "string" ? s.value : JSON.stringify(s.value)}>
                            <div className="truncate">{jsonPreview(s.value)}</div>
                          </td>
                          <td className="num-cell text-xs text-ink-3">v{s.version}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="card p-0">
            <div className="card-head">
              <span className="ch-title">
                <span className="ch-ic"><Flag className="size-4" aria-hidden /></span>
                {t("admin.settings.flags")}
              </span>
            </div>
            <div className="list-group max-h-96 overflow-y-auto">
              {data.flags.map((f) => (
                <div key={f.key} className="list-item">
                  <div className="li-body">
                    <div className="mono li-title text-xs" dir="ltr">{f.key}</div>
                    <div className="li-sub truncate">{f.description ?? "—"}</div>
                  </div>
                  <span className="li-end flex items-center gap-2">
                    <span className="hidden text-[10px] text-ink-3 sm:block">{f.enabled ? t("admin.settings.flags.on") : t("admin.settings.flags.off")}</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="flex">
                          <Switch checked={f.enabled} disabled aria-label={f.key} />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top">{t("admin.settings.flags.hint")}</TooltipContent>
                    </Tooltip>
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-0">
            <div className="card-head">
              <span className="ch-title">
                <span className="ch-ic"><Hash className="size-4" aria-hidden /></span>
                {t("admin.settings.sequences")}
              </span>
            </div>
            <div className="card-body grid gap-3">
              <Badge variant="outline" className="w-fit b-amber">{t("admin.settings.sequences.note")}</Badge>
              <div className="table-wrap max-h-64 overflow-y-auto rounded-lg border">
                <table className="table sm">
                  <thead>
                    <tr>
                      <th>{t("admin.settings.col.key")}</th>
                      <th>{t("admin.settings.sequences.next")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.sequences.map((s) => (
                      <tr key={s.key}>
                        <td className="mono text-xs" dir="ltr">{s.key}</td>
                        <td className="mono num-cell text-xs">{s.next}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <div className="card p-0">
          <div className="card-head">
            <span className="ch-title">
              <span className="ch-ic"><Award className="size-4" aria-hidden /></span>
              {t("admin.settings.licenses")}
            </span>
          </div>
          <div className="card-body">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.licenses.map((l) => (
                <div key={l.number} className="rounded-xl border border-line bg-surface-2 p-3 flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{l.nameAr}</div>
                      <div className="mono text-[10px] text-ink-3" dir="ltr">{l.number}</div>
                    </div>
                    <Badge variant="outline" className="mono shrink-0 text-[9px]">{l.kind}</Badge>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-xs text-ink-3">
                    <span className="mono" dir="ltr"><span className="sr-only">{t("admin.settings.licenses.expires")}: </span>{l.expiresAt}</span>
                    <DaysBadge days={l.daysLeft} />
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 flex items-center gap-1.5 text-[11px] text-ink-3">
              <BadgeCheck className="size-3.5 shrink-0" aria-hidden /> {t("admin.sec.nhra.desc")}
            </p>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
