"use client";
/**
 * الأشعة — RIS/PACS-style worklist: studies table + new-study capture dialog
 * (patient search with demo-directory fallback + mandatory pregnancy check →
 * 412 CONSENT_REQUIRED handled as problem+json toast). Report dialog: lab-radreport.
 */
import { useEffect, useRef, useState } from "react";
import { Info, Plus, Scan, TriangleAlert } from "lucide-react";
import { useI18n } from "@/i18n";
import { apiGet, apiPost } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import { bhTimeString } from "@/lib/bahrain";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/badges";
import { LabPanel, errText, useLab, type PickPatient, type StudyRow } from "./lab-shared";
import { ReportDialog } from "./lab-radreport";

const RAD_TYPES = ["US-ABD", "US-NECK", "US-BREAST", "US-KUB", "DXR-PA", "DXR-BW", "DXR-PANO", "MG"] as const;

function PatientSearch({ picked, onPick, onClear }: { picked: PickPatient | null; onPick: (p: PickPatient) => void; onClear: () => void }) {
  const { t, lang } = useI18n();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<PickPatient[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [fallback, setFallback] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const q = query.trim();
    if (q.length < 2) { setHits(null); setFallback(false); return; }
    setBusy(true);
    timer.current = setTimeout(async () => {
      try {
        const d = await apiGet<{ exact: PickPatient[]; similar: PickPatient[] }>(`/api/staff/patients/search?query=${encodeURIComponent(q)}`);
        setFallback(false);
        setHits([...d.exact, ...d.similar]);
      } catch {
        // FORBIDDEN for radiology-only roles → demo directory, local filter
        try {
          const dir = await apiGet<PickPatient[]>("/api/patient/login-options");
          const nq = q.replace(/[أإآ]/g, "ا").toLowerCase();
          setFallback(true);
          setHits(dir.filter((p) => p.nameAr.replace(/[أإآ]/g, "ا").includes(nq) || (p.nameEn ?? "").toLowerCase().includes(nq) || p.mrn.toLowerCase().includes(nq) || (p.phone ?? "").includes(q)));
        } catch { setHits([]); }
      } finally { setBusy(false); }
    }, 350);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [query]);

  if (picked) {
    return (
      <div className="rounded-lg border border-primary/40 bg-primary/5 p-3 flex flex-wrap items-center gap-3">
        <div className="min-w-0">
          <div className="font-semibold text-sm truncate">{picked.nameAr}</div>
          <div className="text-xs text-muted-foreground font-mono">MRN {picked.mrn}{picked.phone ? ` · ${picked.phone}` : ""}</div>
        </div>
        <Button variant="outline" size="sm" className="ms-auto h-9" onClick={() => { setQuery(""); onClear(); }}>{t("common.edit")}</Button>
      </div>
    );
  }
  return (
    <div className="grid gap-2">
      <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("search.placeholder")} className="h-11" aria-label={t("lab.rad.pick")} />
      {fallback && <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Info className="size-3.5 shrink-0" aria-hidden />{t("lab.rad.fallback")}</p>}
      {busy && <div className="grid gap-2">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-11" />)}</div>}
      {!busy && hits && hits.length > 0 && (
        <div className="rounded-xl border divide-y max-h-56 overflow-y-auto" role="listbox" aria-label={t("lab.rad.pick")}>
          {hits.map((p) => (
            <button key={p.id} role="option" aria-selected={false} onClick={() => onPick(p)} className="w-full flex items-center gap-3 px-3 py-2.5 text-start hover:bg-muted/60 transition-colors min-h-11">
              <span className="text-sm font-medium truncate">{lang === "ar" ? p.nameAr : p.nameEn || p.nameAr}</span>
              <span className="text-xs font-mono text-muted-foreground">{p.mrn}</span>
            </button>
          ))}
        </div>
      )}
      {!busy && query.trim().length >= 2 && hits && hits.length === 0 && <p className="text-sm text-muted-foreground py-1">{t("search.empty")}</p>}
    </div>
  );
}

function CaptureDialog({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const [picked, setPicked] = useState<PickPatient | null>(null);
  const [typeCode, setTypeCode] = useState<string>("US-ABD");
  const [preg, setPreg] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!picked) return;
    setBusy(true);
    try {
      const r = await apiPost<{ id: string; code: string }>("/api/staff/radiology/capture", { patientId: picked.id, typeCode, pregnancyChecked: preg });
      toast({ title: t("lab.rad.captured", { code: r.code }) });
      onDone();
      onClose();
    } catch (e) {
      toast({ title: t("common.error"), description: errText(e, lang), variant: "destructive" });
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Scan className="size-5 text-primary" aria-hidden />{t("lab.rad.new")}</DialogTitle>
          <DialogDescription>{t("lab.rad.hint")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>{t("lab.rad.pick")}</Label>
            <PatientSearch picked={picked} onPick={setPicked} onClear={() => setPicked(null)} />
          </div>
          <div className="grid gap-1.5">
            <Label>{t("lab.rad.type")}</Label>
            <Select value={typeCode} onValueChange={setTypeCode}>
              <SelectTrigger className="h-10 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {RAD_TYPES.map((c) => <SelectItem key={c} value={c} className="text-xs">{t(`lab.rad.type.${c}`)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Label className="flex items-start gap-2.5 font-normal cursor-pointer rounded-lg border bg-amber-50/60 dark:bg-amber-950/20 p-3 text-sm">
            <Checkbox checked={preg} onCheckedChange={(v) => setPreg(v === true)} className="mt-0.5" />
            <span>{t("lab.rad.preg")}</span>
          </Label>
        </div>
        <DialogFooter>
          <p className="text-xs text-muted-foreground flex-1">{picked && !preg ? (<span className="inline-flex items-center gap-1.5"><TriangleAlert className="size-3.5 shrink-0" aria-hidden />{t("lab.rad.needPick")}</span>) : ""}</p>
          <Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
          <Button disabled={!picked || !preg || busy} onClick={submit}>{busy ? "…" : t("lab.rad.capture")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function RadTab() {
  const { t } = useI18n();
  const { data, loading, error, reload } = useLab<StudyRow[]>("/api/staff/radiology/worklist");
  const [capture, setCapture] = useState(false);
  const [reportFor, setReportFor] = useState<StudyRow | null>(null);
  const rows = data ?? [];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs text-muted-foreground flex-1 min-w-52">{t("lab.rad.hint")}</p>
        <Button size="sm" className="h-9" onClick={() => setCapture(true)}><Plus className="size-4" aria-hidden />{t("lab.rad.new")}</Button>
      </div>

      <LabPanel loading={loading} error={error} onRetry={reload} isEmpty={rows.length === 0}>
        <div className="rounded-lg border overflow-x-auto">
          <Table className="text-xs">
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="h-9 min-w-28">{t("common.code")}</TableHead>
                <TableHead className="h-9 min-w-44">{t("common.name")}</TableHead>
                <TableHead className="h-9 w-24">{t("common.status")}</TableHead>
                <TableHead className="h-9 w-24">{t("lab.rad.grade")}</TableHead>
                <TableHead className="h-9 w-24">{t("lab.rad.signed")}</TableHead>
                <TableHead className="h-9 w-20 text-end">{t("common.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((s) => (
                <TableRow key={s.id} className="[&>td]:py-1.5 [&>td]:px-2">
                  <TableCell className="font-mono whitespace-nowrap">{s.code}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-medium truncate max-w-40">{s.patient.nameAr}</span>
                      <span className="font-mono text-muted-foreground">{s.patient.mrn}</span>
                    </div>
                  </TableCell>
                  <TableCell><StatusBadge status={s.status} /></TableCell>
                  <TableCell>{s.grade ? <Badge variant="outline" className="font-mono text-[10px] border-transparent bg-teal-100 text-teal-900 dark:bg-teal-950 dark:text-teal-200">{s.grade}</Badge> : <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell className="font-mono tabular-nums whitespace-nowrap">{s.signedAt ? bhTimeString(s.signedAt) : "—"}</TableCell>
                  <TableCell className="text-end">
                    <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={() => setReportFor(s)}>{t("lab.rad.report")}</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </LabPanel>

      {capture && <CaptureDialog open onClose={() => setCapture(false)} onDone={reload} />}
      {reportFor && <ReportDialog study={reportFor} open onClose={() => setReportFor(null)} onDone={reload} />}
    </div>
  );
}
