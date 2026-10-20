"use client";
/**
 * النتائج — entry queue for collected lab items, manual entry with the §17.9
 * autoverification response panel, HL7 v2 analyzer simulation, and release
 * verification for results awaiting a human.
 */
import { useMemo, useState } from "react";
import { useI18n, bi } from "@/i18n";
import { apiPost } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/badges";
import { FlagBadge, PriorityBadge, errText, randInRef, useLab, type Hl7Resp, type LabWorklist, type OrderListRow, type ResultResp } from "./lab-shared";

interface EntryRow { itemId: string; testAr: string; testEn: string | null; itemStatus: string; orderCode: string; priority: string; patient: { mrn: string; nameAr: string } }

function ResultDialog({ row, open, onClose, onSaved }: { row: EntryRow; open: boolean; onClose: () => void; onSaved: () => void }) {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const [value, setValue] = useState("");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [resp, setResp] = useState<ResultResp | null>(null);

  const save = async () => {
    if (!Number.isFinite(Number(value))) { toast({ title: t("common.error"), description: t("lab.res.needValue"), variant: "destructive" }); return; }
    setBusy(true);
    try {
      const r = await apiPost<ResultResp>("/api/staff/lab/result", { orderItemId: row.itemId, value: Number(value), comment: comment.trim() || undefined });
      setResp(r);
      onSaved();
    } catch (e) {
      toast({ title: t("common.error"), description: errText(e, lang), variant: "destructive" });
    } finally { setBusy(false); }
  };
  const verify = async () => {
    if (!resp) return;
    setBusy(true);
    try {
      await apiPost("/api/staff/lab/verify", { resultId: resp.id, release: true });
      toast({ title: t("lab.res.verified") });
      onClose();
    } catch (e) {
      toast({ title: t("common.error"), description: errText(e, lang), variant: "destructive" });
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("lab.res.enter")} — {bi(lang, row.testAr, row.testEn)}</DialogTitle>
          <DialogDescription>{row.patient.nameAr} · MRN {row.patient.mrn} · {row.orderCode}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="lb-val">{t("lab.res.value")}</Label>
              <Input id="lb-val" type="number" step="any" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} className="h-10 font-mono" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="lb-cmt">{t("lab.res.comment")}</Label>
              <Input id="lb-cmt" value={comment} onChange={(e) => setComment(e.target.value)} className="h-10" />
            </div>
          </div>
          {resp && (
            <div className="grid gap-2 rounded-lg border p-3">
              <div className="flex items-center gap-2 text-sm"><FlagBadge flag={resp.flag} /><span className="text-xs text-muted-foreground">{t(`lab.res.reason.${resp.reason}`)}</span></div>
              {resp.autoVerified ? (
                <Alert className="border-emerald-300 bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
                  <AlertDescription>🤖 {t("lab.res.auto")}</AlertDescription>
                </Alert>
              ) : (
                <>
                  <Alert className="border-amber-300 bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                    <AlertDescription>⚠️ {t("lab.res.human")} — {t(`lab.res.reason.${resp.reason}`)}{resp.deltaPct != null ? ` · ${t("lab.res.delta", { p: resp.deltaPct })}` : ""}</AlertDescription>
                  </Alert>
                  <Button disabled={busy} onClick={verify}>{busy ? "…" : t("lab.res.verify")}</Button>
                </>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("common.close")}</Button>
          {!resp && <Button disabled={busy} onClick={save}>{busy ? "…" : t("lab.res.save")}</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ResultsTab() {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const wl = useLab<LabWorklist>("/api/staff/lab/worklist");
  const orders = useLab<OrderListRow[]>("/api/staff/orders/list");
  const [entryFor, setEntryFor] = useState<EntryRow | null>(null);
  const [hl7, setHl7] = useState<string[] | null>(null);
  const [busyItem, setBusyItem] = useState<string | null>(null);
  const [busyVerify, setBusyVerify] = useState<string | null>(null);

  const entry = useMemo<EntryRow[]>(() => (orders.data ?? [])
    .filter((o) => o.kind === "lab" && ["signed", "received", "in-progress"].includes(o.status))
    .sort((a, b) => (a.priority === "stat" ? -1 : 0) - (b.priority === "stat" ? -1 : 0))
    .flatMap((o) => o.items
      .filter((i) => ["collected", "ordered"].includes(i.status))
      .map((i) => ({ itemId: i.id, testAr: i.nameAr, testEn: i.nameEn, itemStatus: i.status, orderCode: o.code, priority: o.priority, patient: o.patient }))), [orders.data]);

  const pushAnalyzer = async (row: EntryRow) => {
    setBusyItem(row.itemId);
    try {
      const r = await apiPost<Hl7Resp>("/api/staff/lab/analyzer-push", { orderItemId: row.itemId, value: randInRef(row.testEn) });
      setHl7(r.hl7.segments);
      wl.reload(); orders.reload();
    } catch (e) {
      toast({ title: t("common.error"), description: errText(e, lang), variant: "destructive" });
    } finally { setBusyItem(null); }
  };
  const verifyPending = async (id: string) => {
    setBusyVerify(id);
    try {
      await apiPost("/api/staff/lab/verify", { resultId: id, release: true });
      toast({ title: t("lab.res.verified") });
      wl.reload();
    } catch (e) {
      toast({ title: t("common.error"), description: errText(e, lang), variant: "destructive" });
    } finally { setBusyVerify(null); }
  };
  const reloadAll = () => { wl.reload(); orders.reload(); };
  return (
    <div className="space-y-4">
      <Card className="gap-3">
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm">🔬 {t("lab.res.entry")} <span className="text-xs font-normal text-muted-foreground">({entry.length})</span></CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 pt-0">
          <p className="text-xs text-muted-foreground mb-2">{t("lab.res.entryHint")}</p>
          {orders.loading ? <div className="h-16 rounded-lg bg-muted/40 animate-pulse" /> : entry.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">{t("common.empty")}</div>
          ) : (
            <div className="rounded-lg border overflow-x-auto">
              <Table className="text-xs">
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="h-9 w-20">{t("common.priority")}</TableHead>
                    <TableHead className="h-9 min-w-28">{t("lab.res.order")}</TableHead>
                    <TableHead className="h-9 min-w-44">{t("common.name")}</TableHead>
                    <TableHead className="h-9 min-w-32">{t("lab.res.test")}</TableHead>
                    <TableHead className="h-9 w-24">{t("common.status")}</TableHead>
                    <TableHead className="h-9 w-56 text-end">{t("common.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entry.map((r) => (
                    <TableRow key={r.itemId} className="[&>td]:py-1.5 [&>td]:px-2">
                      <TableCell><PriorityBadge priority={r.priority} /></TableCell>
                      <TableCell className="font-mono whitespace-nowrap">{r.orderCode}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-medium truncate max-w-40">{r.patient.nameAr}</span>
                          <span className="font-mono text-muted-foreground">{r.patient.mrn}</span>
                        </div>
                      </TableCell>
                      <TableCell className="truncate max-w-36">{bi(lang, r.testAr, r.testEn)}</TableCell>
                      <TableCell>{r.itemStatus === "ordered" ? <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">{t("lab.res.specimenPending")}</Badge> : <StatusBadge status={r.itemStatus} />}</TableCell>
                      <TableCell className="text-end">
                        <div className="inline-flex gap-1">
                          <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={() => setEntryFor(r)}>{t("lab.res.enter")}</Button>
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px] font-mono" disabled={busyItem === r.itemId} title={t("lab.res.analyzer")} aria-label={t("lab.res.analyzer")} onClick={() => pushAnalyzer(r)}>{busyItem === r.itemId ? "…" : "⚙️ محاكاة HL7"}</Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="gap-3">
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm">🧾 {t("lab.res.pending")} <span className="text-xs font-normal text-muted-foreground">({wl.data?.pendingResults.length ?? 0})</span></CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 pt-0">
          {wl.loading ? <div className="h-16 rounded-lg bg-muted/40 animate-pulse" /> : (wl.data?.pendingResults.length ?? 0) === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">{t("common.empty")}</div>
          ) : (
            <div className="rounded-lg border overflow-x-auto">
              <Table className="text-xs">
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="h-9 min-w-32">{t("lab.res.test")}</TableHead>
                    <TableHead className="h-9 min-w-28">{t("lab.res.value")}</TableHead>
                    <TableHead className="h-9 w-20">{t("common.status")}</TableHead>
                    <TableHead className="h-9 min-w-44">{t("common.name")}</TableHead>
                    <TableHead className="h-9 w-32 text-end">{t("common.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(wl.data?.pendingResults ?? []).map((p) => (
                    <TableRow key={p.id} className="[&>td]:py-1.5 [&>td]:px-2">
                      <TableCell className="truncate max-w-36">{p.test}</TableCell>
                      <TableCell className="font-mono tabular-nums whitespace-nowrap">{p.value ?? "—"} {p.unit}</TableCell>
                      <TableCell><FlagBadge flag={p.flag} /></TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-medium truncate max-w-40">{p.patient.nameAr}</span>
                          <span className="font-mono text-muted-foreground">{p.patient.mrn}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-end">
                        <Button size="sm" className="h-7 px-2 text-[11px]" disabled={busyVerify === p.id} onClick={() => verifyPending(p.id)}>{busyVerify === p.id ? "…" : t("lab.res.verify")}</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {entryFor && <ResultDialog row={entryFor} open onClose={() => setEntryFor(null)} onSaved={reloadAll} />}

      <Dialog open={!!hl7} onOpenChange={(o) => !o && setHl7(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-mono">HL7 v2 — ORU^R01</DialogTitle>
            <DialogDescription>{t("lab.res.hl7Note")}</DialogDescription>
          </DialogHeader>
          <pre dir="ltr" className="max-h-72 overflow-auto rounded-lg bg-zinc-950 p-3 text-[10px] leading-relaxed text-emerald-300 font-mono whitespace-pre-wrap break-all">
            {(hl7 ?? []).join("\n")}
          </pre>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHl7(null)}>{t("common.close")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
