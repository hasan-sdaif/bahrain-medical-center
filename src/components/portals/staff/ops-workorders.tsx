"use client";
/** Work orders tab — table + detail dialog (meta, local checklist, parts, chat, actions). */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useI18n, bi } from "@/i18n";
import { useApp } from "@/store/app";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/badges";
import { cn } from "@/lib/utils";
import { Panel, SlaChip, fmtDT, useOps, type WoRow } from "./ops-shared";
import { WoChat } from "./ops-wochat";
import { WoActions } from "./ops-woactions";

const KIND_TONE: Record<string, string> = {
  corrective: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  preventive: "bg-teal-100 text-teal-900 dark:bg-teal-950 dark:text-teal-200",
  calibration: "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200",
};

function KindChip({ kind }: { kind: string }) {
  const { t } = useI18n();
  return <Badge variant="outline" className={cn("border-transparent font-medium", KIND_TONE[kind] ?? "")}>{t(`ops.wo.kind.${kind}`)}</Badge>;
}

function PriorityChip({ priority }: { priority: string }) {
  const { t } = useI18n();
  return (
    <span className={cn("text-xs font-medium", priority === "high" ? "text-red-600 dark:text-red-400" : "text-muted-foreground")}>
      {t(`priority.${priority}`)}
    </span>
  );
}

function Meta({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="truncate text-sm">{children}</div>
    </div>
  );
}

export default function WorkOrdersTab() {
  const { t, lang } = useI18n();
  const { staff } = useApp();
  const { data, loading, error, reload } = useOps<WoRow[]>("/api/staff/maintenance/work-orders");
  const [selId, setSelId] = useState<string | null>(null);
  const rows = data ?? [];
  const wo = rows.find((w) => w.id === selId) ?? null;

  const steps = useMemo(() => wo?.checklist?.steps ?? [], [wo?.checklist]);
  const [checks, setChecks] = useState<boolean[]>([]);
  useEffect(() => { setChecks(steps.map((s) => s.done)); }, [steps]);

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">{t("ops.wo.detail.hint")}</p>
      <Panel loading={loading} error={error} onRetry={reload} isEmpty={rows.length === 0} rows={6}>
        <div className="max-h-96 overflow-y-auto rounded-xl border">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-background">
              <TableRow>
                <TableHead className="text-start">{t("common.code")}</TableHead>
                <TableHead className="text-start">{t("ops.wo.asset")}</TableHead>
                <TableHead className="text-start">{t("common.type")}</TableHead>
                <TableHead className="text-start">{t("common.status")}</TableHead>
                <TableHead className="text-start">{t("common.priority")}</TableHead>
                <TableHead className="text-start">{t("ops.wo.sla")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((w) => (
                <TableRow key={w.id} onClick={() => setSelId(w.id)} className="cursor-pointer">
                  <TableCell className="py-2.5 font-mono text-xs">{w.code}</TableCell>
                  <TableCell className="py-2.5">
                    <div className="text-sm font-medium">{bi(lang, w.asset.nameAr, w.asset.nameEn)}</div>
                    <div className="font-mono text-[10px] text-muted-foreground">{w.asset.code}</div>
                  </TableCell>
                  <TableCell className="py-2.5"><KindChip kind={w.kind} /></TableCell>
                  <TableCell className="py-2.5"><StatusBadge status={w.status} /></TableCell>
                  <TableCell className="py-2.5"><PriorityChip priority={w.priority} /></TableCell>
                  <TableCell className="py-2.5">
                    {w.slaDueAt ? <SlaChip minutes={w.dueIn} over={w.overSla} /> : <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Panel>

      <Dialog open={!!wo} onOpenChange={(o) => !o && setSelId(null)}>
        <DialogContent className="max-h-[88vh] max-w-4xl overflow-y-auto">
          {wo ? (
            <>
              <DialogHeader className="text-start">
                <DialogTitle className="flex flex-wrap items-center gap-2">
                  <span className="font-mono">{wo.code}</span>
                  <KindChip kind={wo.kind} />
                  <StatusBadge status={wo.status} />
                  <PriorityChip priority={wo.priority} />
                  <SlaChip minutes={wo.dueIn} over={wo.overSla} />
                </DialogTitle>
                <DialogDescription>
                  {bi(lang, wo.asset.nameAr, wo.asset.nameEn)} · <span className="font-mono">{wo.asset.code}</span>
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-2 text-sm sm:grid-cols-4">
                <Meta label={t("ops.wo.tech")}><span className="font-mono text-xs">{wo.technicianId ?? "—"}</span></Meta>
                <Meta label={t("ops.wo.sla.due")}><span className="font-mono text-xs">{fmtDT(wo.slaDueAt)}</span></Meta>
                <Meta label={t("ops.wo.started")}><span className="font-mono text-xs">{fmtDT(wo.startedAt)}</span></Meta>
                <Meta label={t("ops.wo.finished")}><span className="font-mono text-xs">{fmtDT(wo.finishedAt)}</span></Meta>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-4">
                  <div>
                    <h3 className="mb-1.5 text-sm font-semibold">{t("ops.wo.checklist")}</h3>
                    {steps.length === 0 ? (
                      <p className="text-xs text-muted-foreground">{t("ops.wo.checklist.none")}</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {steps.map((s, i) => (
                          <li key={`${i}-${s.t}`} className="flex min-h-11 items-center gap-2 rounded-lg border px-3">
                            <Checkbox
                              id={`step-${wo.id}-${i}`}
                              checked={checks[i] ?? s.done}
                              onCheckedChange={(v) => setChecks((prev) => prev.map((c, j) => (j === i ? v === true : c)))}
                              aria-label={s.t}
                            />
                            <label htmlFor={`step-${wo.id}-${i}`} className={cn("text-sm", (checks[i] ?? s.done) && "text-muted-foreground line-through")}>
                              {s.t}
                            </label>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div>
                    <h3 className="mb-1.5 text-sm font-semibold">{t("ops.wo.parts")}</h3>
                    {wo.parts.length === 0 ? (
                      <p className="text-xs text-muted-foreground">{t("ops.wo.parts.none")}</p>
                    ) : (
                      <ul className="space-y-1">
                        {wo.parts.map((p) => (
                          <li key={p.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                            <span className="font-mono text-xs">{p.itemCode} ×{p.qty}</span>
                            {p.issuedAt
                              ? <Badge variant="secondary" className="text-[10px]">{t("ops.wo.parts.issued")}</Badge>
                              : <span className="text-xs text-amber-600 dark:text-amber-400">{t("ops.wo.await")}</span>}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <WoActions wo={wo} onReload={reload} />
                </div>

                <div className="min-w-0">
                  <h3 className="mb-1.5 text-sm font-semibold">{t("ops.wo.chat")}</h3>
                  <WoChat wo={wo} myId={staff?.employeeId} onSent={reload} />
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
