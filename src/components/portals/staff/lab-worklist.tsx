"use client";
/**
 * استلام العينات — lab intake worklist with double-scan custody handover,
 * specimen temperature capture and rejection (auto doctor notification).
 */
import { useState } from "react";
import { useI18n } from "@/i18n";
import { apiPost } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import { bhTimeString } from "@/lib/bahrain";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/badges";
import { LabPanel, errText, useLab, type LabWorklist, type SpecimenRow } from "./lab-shared";

const REJECT_REASONS = [
  { v: "hemolysis", k: "lab.rx.rej.hemolysis" },
  { v: "insufficient", k: "lab.rx.rej.insufficient" },
  { v: "wrong-tube", k: "lab.rx.rej.wrongTube" },
  { v: "delayed", k: "lab.rx.rej.delayed" },
] as const;

function ReceiveDialog({ row, open, onClose, onDone }: { row: SpecimenRow; open: boolean; onClose: () => void; onDone: (rejected: boolean) => void }) {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const [tempC, setTempC] = useState("4.0");
  const [reject, setReject] = useState<string>("none");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await apiPost("/api/staff/lab/receive", {
        specimenId: row.id,
        tempC: Number(tempC) || undefined,
        reject: reject === "none" ? undefined : reject,
      });
      onDone(reject !== "none");
      onClose();
    } catch (e) {
      toast({ title: t("common.error"), description: errText(e, lang), variant: "destructive" });
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("lab.tab.receive")} — <span className="font-mono">{row.code}</span></DialogTitle>
          <DialogDescription>{row.patient.nameAr} · MRN {row.patient.mrn}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="lb-temp">{t("lab.rx.temp")}</Label>
            <Input id="lb-temp" type="number" step="0.1" inputMode="decimal" value={tempC} onChange={(e) => setTempC(e.target.value)} className="h-10" />
          </div>
          <div className="grid gap-1.5">
            <Label>{t("common.status")}</Label>
            <Select value={reject} onValueChange={setReject}>
              <SelectTrigger className="h-10 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none" className="text-xs">✅ {t("lab.rx.acceptOpt")}</SelectItem>
                {REJECT_REASONS.map((r) => <SelectItem key={r.v} value={r.v} className="text-xs">⛔ {t(r.k)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
          <Button variant={reject === "none" ? "default" : "destructive"} disabled={busy} onClick={submit}>
            {busy ? "…" : reject === "none" ? t("lab.rx.acceptOpt") : t("lab.rx.rejectOpt")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ReceiveTab() {
  const { t } = useI18n();
  const { toast } = useToast();
  const { data, loading, error, reload } = useLab<LabWorklist>("/api/staff/lab/worklist");
  const [recv, setRecv] = useState<SpecimenRow | null>(null);
  const [rejected, setRejected] = useState<SpecimenRow | null>(null);
  const rows = (data?.specimens ?? []).filter((s) => s.status !== "rejected");

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">{t("lab.rx.hint")}</p>

      {rejected && (
        <Alert variant="destructive">
          <AlertTitle>{t("lab.rx.rejected.title", { code: rejected.code })}</AlertTitle>
          <AlertDescription>{t("lab.rx.rejected.body")}</AlertDescription>
        </Alert>
      )}

      <LabPanel loading={loading} error={error} onRetry={reload} isEmpty={rows.length === 0}>
        <div className="rounded-lg border overflow-x-auto">
          <Table className="text-xs">
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="h-9 min-w-28">{t("lab.phleb.specimen")}</TableHead>
                <TableHead className="h-9 min-w-44">{t("common.name")}</TableHead>
                <TableHead className="h-9 w-24">{t("lab.phleb.collectedAt")}</TableHead>
                <TableHead className="h-9 w-24">{t("common.status")}</TableHead>
                <TableHead className="h-9 w-24 text-end">{t("common.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((s) => (
                <TableRow key={s.id} className="[&>td]:py-1.5 [&>td]:px-2">
                  <TableCell className="font-mono whitespace-nowrap">{s.code}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-medium truncate max-w-44">{s.patient.nameAr}</span>
                      <span className="font-mono text-muted-foreground">{s.patient.mrn}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono tabular-nums whitespace-nowrap">{s.collectedAt ? bhTimeString(s.collectedAt) : "—"}</TableCell>
                  <TableCell><StatusBadge status={s.status} /></TableCell>
                  <TableCell className="text-end">
                    <Button size="sm" className="h-7 px-2 text-[11px]" onClick={() => setRecv(s)}>{t("lab.rx.receive")}</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </LabPanel>

      {recv && (
        <ReceiveDialog
          row={recv} open
          onClose={() => setRecv(null)}
          onDone={(wasRejected) => {
            if (wasRejected) { setRejected(recv); toast({ title: t("lab.rx.rejected.title", { code: recv.code }), description: t("lab.rx.rejected.body"), variant: "destructive" }); }
            else { setRejected(null); toast({ title: t("lab.rx.ok", { code: recv.code }) }); }
            reload();
          }}
        />
      )}
    </div>
  );
}
