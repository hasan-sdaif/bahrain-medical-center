"use client";
/**
 * Inventory tab (agent S4) — items with par levels, FEFO-ordered batches,
 * recent bin moves. Stock-per-item is not derivable from the payload (batches
 * carry no owner link), so items show par/reorder + cost; live stock lines
 * live in pharmacy dispensing (FEFO).
 */
import { useI18n, bi } from "@/i18n";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MoneyText } from "@/components/shared/badges";
import { PackageCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { daysUntil, fmtDT, Panel, useOps, type InventoryResp } from "./ops-shared";

const BATCH_TONE: Record<string, string> = {
  ok: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  quarantine: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  recalled: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200 animate-pulse",
  expired: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};
const MOVE_TONE: Record<string, string> = {
  receipt: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  issue: "bg-teal-100 text-teal-900 dark:bg-teal-950 dark:text-teal-200",
  transfer: "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200",
  adjust: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  waste: "bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200",
  return: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

/** expiry countdown chip — red <30d, amber <90d (FEFO horizon) */
function ExpChip({ expiry }: { expiry: string }) {
  const { t } = useI18n();
  const d = daysUntil(expiry);
  if (d == null) return <span className="text-xs text-muted-foreground">—</span>;
  const tone = d < 30
    ? "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200"
    : d < 90
      ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
      : "bg-teal-100 text-teal-900 dark:bg-teal-950 dark:text-teal-200";
  return (
    <span className={cn("ms-1.5 inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium tabular-nums", tone)}>
      {d < 0 ? t("ops.days.late", { n: Math.abs(d) }) : t("ops.days.left", { n: d })}
    </span>
  );
}

export default function InventoryTab() {
  const { t, lang } = useI18n();
  const { data, loading, error, reload } = useOps<InventoryResp>("/api/staff/inventory/items");
  const items = data?.items ?? [];
  const batches = data?.batches ?? [];
  const moves = data?.moves ?? [];

  return (
    <div className="space-y-4">
      <Alert className="border-teal-600/40 bg-teal-50 dark:bg-teal-950/40">
        <PackageCheck className="size-4 text-teal-700 dark:text-teal-300" />
        <AlertDescription className="text-xs font-medium">{t("ops.inv.fefo")}</AlertDescription>
      </Alert>

      <Panel
        loading={loading} error={error} onRetry={reload} rows={6}
        isEmpty={!data || (items.length === 0 && batches.length === 0 && moves.length === 0)}
      >
        <p className="text-xs text-muted-foreground">{t("ops.inv.count", { n: items.length, b: batches.length, m: moves.length })}</p>

        <section className="space-y-1.5">
          <h3 className="text-sm font-semibold">{t("ops.inv.items")}</h3>
          <div className="max-h-96 overflow-auto rounded-xl border">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-background">
                <TableRow>
                  <TableHead className="text-start">{t("common.name")}</TableHead>
                  <TableHead className="text-start">{t("ops.inv.uom")}</TableHead>
                  <TableHead className="text-start">{t("ops.inv.cost")}</TableHead>
                  <TableHead className="text-start">{t("ops.inv.par")}</TableHead>
                  <TableHead className="text-start">{t("ops.inv.reorder")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((it) => (
                  <TableRow key={it.code}>
                    <TableCell className="py-2.5">
                      <div className="font-mono text-[10px] text-muted-foreground">{it.code}</div>
                      <div className="text-sm font-medium">{bi(lang, it.nameAr, it.nameEn)}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        <Badge variant="secondary" className="text-[10px]">{t(`ops.inv.cat.${it.category}`)}</Badge>
                        {it.controlled ? (
                          <Badge variant="outline" className="border-transparent bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200">{t("ops.inv.controlled")}</Badge>
                        ) : null}
                        <Badge variant="outline" className="text-[10px] font-normal">{t(`ops.inv.storage.${it.storage}`)}</Badge>
                      </div>
                    </TableCell>
                    <TableCell className="py-2.5 font-mono text-xs">{it.uom}</TableCell>
                    <TableCell className="py-2.5"><MoneyText fils={it.costFils} className="text-xs" /></TableCell>
                    <TableCell className="py-2.5 font-mono text-xs tabular-nums">{it.parLevel}</TableCell>
                    <TableCell className="py-2.5 font-mono text-xs tabular-nums text-muted-foreground">{it.reorderQty}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>

        <section className="space-y-1.5">
          <h3 className="text-sm font-semibold">{t("ops.inv.batches")}</h3>
          <div className="max-h-96 overflow-auto rounded-xl border">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-background">
                <TableRow>
                  <TableHead className="text-start">{t("ops.inv.lot")}</TableHead>
                  <TableHead className="text-start">{t("ops.inv.qty")}</TableHead>
                  <TableHead className="text-start">{t("ops.inv.expiry")}</TableHead>
                  <TableHead className="text-start">{t("common.status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.map((b) => (
                  <TableRow key={b.lotNo}>
                    <TableCell className="py-2.5 font-mono text-xs">{b.lotNo}</TableCell>
                    <TableCell className="py-2.5 font-mono text-xs tabular-nums">{b.qty}</TableCell>
                    <TableCell className="py-2.5">
                      <span className="font-mono text-xs">{b.expiry}</span>
                      <ExpChip expiry={b.expiry} />
                    </TableCell>
                    <TableCell className="py-2.5">
                      <Badge variant="outline" className={cn("border-transparent font-medium", BATCH_TONE[b.status] ?? "")}>
                        {t(`ops.inv.batch.${b.status}`)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>

        <section className="space-y-1.5">
          <h3 className="text-sm font-semibold">{t("ops.inv.moves")}</h3>
          <div className="max-h-96 overflow-auto rounded-xl border">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-background">
                <TableRow>
                  <TableHead className="text-start">{t("common.type")}</TableHead>
                  <TableHead className="text-start">{t("ops.inv.qty")}</TableHead>
                  <TableHead className="text-start">{t("ops.inv.bin")}</TableHead>
                  <TableHead className="text-start">{t("common.reason")}</TableHead>
                  <TableHead className="text-start">{t("common.date")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {moves.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="py-2.5">
                      <Badge variant="outline" className={cn("border-transparent font-medium", MOVE_TONE[m.type] ?? "")}>
                        {t(`ops.inv.move.${m.type}`)}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-2.5 font-mono text-xs tabular-nums">{m.qty}</TableCell>
                    <TableCell className="py-2.5 font-mono text-[11px] text-muted-foreground">
                      <span dir="ltr">{m.fromBin ?? "—"} → {m.toBin ?? "—"}</span>
                    </TableCell>
                    <TableCell className="max-w-48 truncate py-2.5 text-xs" title={m.reason ?? undefined}>{m.reason ?? "—"}</TableCell>
                    <TableCell className="py-2.5 font-mono text-[11px] text-muted-foreground">{fmtDT(m.at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      </Panel>
    </div>
  );
}
