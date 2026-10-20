"use client";
/**
 * سحب الدم — phlebotomy worklist (STAT first), two-identifier draw
 * verification checklist, specimen creation + Code 128 label printout.
 */
import { useRef, useState } from "react";
import { CheckCircle2, Printer, TriangleAlert } from "lucide-react";
import { useI18n, bi } from "@/i18n";
import { apiPost } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import { bhTimeString } from "@/lib/bahrain";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Code128 } from "@/components/shared/barcode";
import { StatusBadge } from "@/components/shared/badges";
import { AssuranceDot, LabPanel, LabPrintStyle, PriorityBadge, errText, printLabel, useLab, type DrawResp, type PhlebRow } from "./lab-shared";

const DIFFICULTIES = ["normal", "difficult", "patient-not-fasting", "vein-collapse"] as const;

function DrawDialog({ row, open, onClose, onDone }: { row: PhlebRow; open: boolean; onClose: () => void; onDone: (r: DrawResp) => void }) {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const [nameOk, setNameOk] = useState(false);
  const [mrnOk, setMrnOk] = useState(false);
  const [fastOk, setFastOk] = useState(false);
  const [tubes, setTubes] = useState("1");
  const [difficulty, setDifficulty] = useState<string>("normal");
  const [incident, setIncident] = useState("");
  const [busy, setBusy] = useState(false);
  const canSubmit = nameOk && mrnOk && (!row.fasting || fastOk);

  const submit = async () => {
    setBusy(true);
    try {
      const r = await apiPost<DrawResp>("/api/staff/phleb/draw", {
        orderId: row.orderId, tubes: Number(tubes) || 1, difficulty,
        incident: incident.trim() || undefined,
      });
      onDone(r);
    } catch (e) {
      toast({ title: t("common.error"), description: errText(e, lang), variant: "destructive" });
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("lab.phleb.draw")} — {row.patient.nameAr}</DialogTitle>
          <DialogDescription>{t("lab.phleb.verify")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="rounded-lg border bg-muted/40 p-3 grid gap-2.5 text-sm">
            <Label className="flex items-start gap-2.5 font-normal cursor-pointer">
              <Checkbox checked={nameOk} onCheckedChange={(v) => setNameOk(v === true)} className="mt-0.5" />
              <span>{t("lab.phleb.verify.name")}</span>
            </Label>
            <Label className="flex items-start gap-2.5 font-normal cursor-pointer">
              <Checkbox checked={mrnOk} onCheckedChange={(v) => setMrnOk(v === true)} className="mt-0.5" />
              <span>{t("lab.phleb.verify.mrn")} <span className="font-mono text-xs">{row.patient.mrn}</span></span>
            </Label>
            {row.fasting && (
              <Label className="flex items-start gap-2.5 font-normal cursor-pointer">
                <Checkbox checked={fastOk} onCheckedChange={(v) => setFastOk(v === true)} className="mt-0.5" />
                <span>{t("lab.phleb.verify.fasting")}</span>
              </Label>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="lb-tubes">{t("lab.phleb.tubes")}</Label>
              <Input id="lb-tubes" type="number" min={1} max={10} inputMode="numeric" value={tubes} onChange={(e) => setTubes(e.target.value)} className="h-10" />
            </div>
            <div className="grid gap-1.5">
              <Label>{t("lab.phleb.difficulty")}</Label>
              <Select value={difficulty} onValueChange={setDifficulty}>
                <SelectTrigger className="h-10 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DIFFICULTIES.map((dv) => <SelectItem key={dv} value={dv} className="text-xs">{t(`lab.phleb.diff.${dv === "patient-not-fasting" ? "notfasting" : dv === "vein-collapse" ? "collapse" : dv}`)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="lb-incident">{t("lab.phleb.incident")}</Label>
            <Input id="lb-incident" value={incident} onChange={(e) => setIncident(e.target.value)} placeholder={t("lab.phleb.incident.ph")} className="h-10" />
          </div>
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <p className="text-xs text-muted-foreground flex-1">{canSubmit ? "" : (<span className="inline-flex items-center gap-1.5"><TriangleAlert className="size-3.5 shrink-0" aria-hidden />{t("lab.phleb.needVerify")}</span>)}</p>
          <Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
          <Button disabled={!canSubmit || busy} onClick={submit}>{busy ? "…" : t("lab.phleb.draw")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function PhlebTab() {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const { data, loading, error, reload } = useLab<PhlebRow[]>("/api/staff/phleb/worklist");
  const [drawRow, setDrawRow] = useState<PhlebRow | null>(null);
  const [done, setDone] = useState<{ resp: DrawResp; row: PhlebRow } | null>(null);
  const printRef = useRef<HTMLDivElement>(null);
  const rows = data ?? [];

  return (
    <div className="space-y-3">
      <LabPrintStyle />
      <p className="text-xs text-muted-foreground">{t("lab.phleb.hint")}</p>

      <LabPanel loading={loading} error={error} onRetry={reload} isEmpty={rows.length === 0}>
        <div className="rounded-lg border overflow-x-auto">
          <Table className="text-xs">
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="h-9 w-20">{t("common.priority")}</TableHead>
                <TableHead className="h-9 min-w-40">{t("lab.res.order")}</TableHead>
                <TableHead className="h-9 min-w-44">{t("common.name")}</TableHead>
                <TableHead className="h-9 min-w-40">{t("lab.phleb.tests")}</TableHead>
                <TableHead className="h-9 w-20">{t("lab.phleb.fasting")}</TableHead>
                <TableHead className="h-9 w-32">{t("lab.phleb.specimen")}</TableHead>
                <TableHead className="h-9 w-24 text-end">{t("common.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.orderId} className="[&>td]:py-1.5 [&>td]:px-2">
                  <TableCell><PriorityBadge priority={r.priority} /></TableCell>
                  <TableCell className="font-mono whitespace-nowrap">{r.code}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <AssuranceDot level={r.patient.assurance} />
                      <span className="font-medium truncate max-w-40">{r.patient.nameAr}</span>
                      <span className="font-mono text-muted-foreground">{r.patient.mrn}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {r.items.slice(0, 3).map((it, i) => <Badge key={i} variant="outline" className="text-[10px] font-normal">{bi(lang, it.nameAr)}</Badge>)}
                      {r.items.length > 3 && <Badge variant="outline" className="text-[10px] font-mono">+{r.items.length - 3}</Badge>}
                    </div>
                  </TableCell>
                  <TableCell>{r.fasting ? <Badge variant="outline" className="border-transparent bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 text-[10px]">{t("lab.phleb.fasting")}</Badge> : <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell>
                    {r.specimen ? (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono">{r.specimen.code}</span>
                        <StatusBadge status={r.specimen.status} />
                      </div>
                    ) : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-end">
                    {!r.specimen && <Button size="sm" className="h-7 px-2 text-[11px]" onClick={() => setDrawRow(r)}>{t("lab.phleb.draw")}</Button>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </LabPanel>

      {drawRow && (
        <DrawDialog
          row={drawRow} open
          onClose={() => setDrawRow(null)}
          onDone={(resp) => {
            setDrawRow(null);
            setDone({ resp, row: drawRow });
            toast({ title: t("lab.phleb.done", { code: resp.code }) });
            reload();
          }}
        />
      )}

      <Dialog open={!!done} onOpenChange={(o) => !o && setDone(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><CheckCircle2 className="size-5 text-emerald-600" aria-hidden />{t("lab.phleb.done", { code: done?.resp.code ?? "" })}</DialogTitle>
            <DialogDescription>{t("lab.phleb.custody")}</DialogDescription>
          </DialogHeader>
          {done && (
            <div className="grid gap-3">
              <div ref={printRef} className="print-area rounded-xl border-2 border-dashed p-4 text-center bg-white text-black grid gap-2">
                <div className="text-[11px] font-semibold">{t("lab.phleb.label.sub")}</div>
                <div className="text-sm font-bold">{t("lab.phleb.label")} — {done.row.patient.nameAr}</div>
                <div className="font-mono text-xs">MRN {done.row.patient.mrn} · {done.row.code}</div>
                <div className="font-mono text-lg font-bold tracking-wider">{done.resp.code}</div>
                <div className="flex justify-center text-foreground"><Code128 value={done.resp.barcode} height={52} /></div>
                <div className="font-mono text-[10px]">{t("lab.phleb.collectedAt")}: {bhTimeString(new Date())}</div>
              </div>
              <DialogFooter className="sm:justify-between">
                <Button variant="outline" onClick={() => setDone(null)}>{t("common.close")}</Button>
                <Button onClick={() => printLabel(printRef.current)}><Printer className="size-4" aria-hidden />{t("lab.phleb.print")}</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
