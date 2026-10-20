"use client";
/**
 * reception-search — بحث وتسجيل: unified fuzzy search + smart-card reader
 * + registration (chip-locked or manual) + success card (MRN, print, book, check-in).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { apiGet, apiPost } from "@/lib/api-client";
import { useI18n, bi } from "@/i18n";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Code128 } from "@/components/shared/barcode";
import { CreditCard, Plus, TriangleAlert } from "lucide-react";
import { AssuranceDot, Empty, ErrorBox, LoadingRows, PrintStyle, errText, setLastPatient, type CheckinResp, type ReaderResp, type RegisterResp, type SearchResp } from "./emr-shared";
import { RegisterForm, type RegisterMode } from "./reception-register";
import { SuccessCard } from "./reception-success";

export function ReceptionSearch() {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [resp, setResp] = useState<SearchResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cardIdx, setCardIdx] = useState("0");
  const [reading, setReading] = useState(false);
  const [reader, setReader] = useState<ReaderResp | null>(null);
  const [mode, setMode] = useState<RegisterMode | null>(null);
  const [registered, setRegistered] = useState<RegisterResp | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const search = useCallback(() => {
    const q = query.trim();
    if (!q) return;
    setLoading(true); setError(null);
    apiGet<SearchResp>(`/api/staff/patients/search?query=${encodeURIComponent(q)}`)
      .then((r) => { setResp(r); if (r.exact.length === 0 && r.similar.length === 0) toast({ title: t("search.empty") }); })
      .catch((e) => setError(errText(e, lang)))
      .finally(() => setLoading(false));
  }, [query, lang, t, toast]);

  const readCard = async () => {
    setReading(true); setError(null);
    try {
      const r = await apiPost<ReaderResp>("/api/staff/reader/read", { cardIndex: Number(cardIdx) });
      setReader(r);
      setRegistered(null);
      setMode(r.existing ? null : "chip");
      toast({ title: r.existing ? t("rec.reader.existing") : t("rec.reader.new"), description: r.record.fullNameAr });
    } catch (e) {
      toast({ title: t("common.error"), description: errText(e, lang), variant: "destructive" });
    } finally { setReading(false); }
  };

  const openFile = (id: string, mrn: string, nameAr: string) => {
    setLastPatient({ id, mrn, nameAr });
    toast({ title: t("rec.openfile.ok", { name: nameAr }), description: t("rec.openfile.hint") });
  };

  const checkinByCpr = async (cpr: string, nameAr: string) => {
    try {
      const r = await apiPost<CheckinResp>("/api/staff/checkin", { cpr });
      toast({ title: t("rec.checkin.ok", { name: nameAr }), description: t("rec.checkin.ticket", { code: r.ticket.code }) });
    } catch (e) {
      toast({ title: t("common.error"), description: errText(e, lang), variant: "destructive" });
    }
  };

  const byCpr = /^\d{9}$/.test(query.trim());

  return (
    <div className="grid gap-4 max-w-5xl">
      <PrintStyle />
      {/* unified search */}
      <div className="grid gap-2">
        <Label htmlFor="rec-search" className="text-xs text-muted-foreground">{t("search.placeholder")}</Label>
        <div className="flex gap-2">
          <Input
            id="rec-search" ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") search(); }}
            className="h-10" placeholder={t("search.placeholder")} />
          <Button className="h-10 px-5" onClick={search} disabled={loading || !query.trim()}>{loading ? t("common.loading") : t("common.search")}</Button>
        </div>
      </div>

      {error && <ErrorBox message={error} onRetry={search} />}
      {loading && <LoadingRows n={3} />}

      {resp && (resp.exact.length > 0 || resp.similar.length > 0) && (
        <div className="grid gap-3">
          {resp.similar.length > 0 && (
            <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/40 p-3 text-xs text-amber-900 dark:text-amber-200 flex items-center gap-2">
              <TriangleAlert className="size-4 shrink-0" aria-hidden />{t("search.dupwarn")} — {t("rec.similar.note")}
            </div>
          )}
          {resp.exact.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3">
              <AssuranceDot level={p.assurance} />
              <div className="min-w-0 flex-1">
                <div className="font-medium text-sm truncate">{bi(lang, p.nameAr, p.nameEn)}</div>
                <div className="text-xs text-muted-foreground font-mono">{p.mrn}{p.idMasked ? ` · ${p.idMasked}` : ""}{p.phone ? ` · ${p.phone}` : ""}</div>
              </div>
              {byCpr && <Button size="sm" variant="outline" className="h-8" onClick={() => checkinByCpr(query.trim(), p.nameAr)}>{t("rec.action.arrive")}</Button>}
              <Button size="sm" className="h-8" onClick={() => openFile(p.id, p.mrn, p.nameAr)}>{t("rec.action.open")}</Button>
            </div>
          ))}
          {resp.similar.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-amber-300 bg-amber-50/50 dark:bg-amber-950/20 p-3">
              <Badge variant="outline" className="bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 border-transparent">{t("rec.similar.score", { n: Math.round(p.score) })}</Badge>
              <div className="min-w-0 flex-1">
                <div className="font-medium text-sm truncate">{p.nameAr}</div>
                <div className="text-xs text-muted-foreground font-mono">{p.mrn}{p.idMasked ? ` · ${p.idMasked}` : ""}</div>
              </div>
              <Button size="sm" variant="outline" className="h-8" onClick={() => openFile(p.id, p.mrn, p.nameAr)}>{t("rec.action.open")}</Button>
            </div>
          ))}
        </div>
      )}

      {resp && resp.exact.length === 0 && resp.similar.length === 0 && !mode && !reader && (
        <Empty label={t("search.empty")} />
      )}

      {/* smart card reader */}
      <div className="rounded-lg border p-3 grid gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold inline-flex items-center gap-2"><CreditCard className="size-4 shrink-0" aria-hidden />{t("rec.reader.title")}</span>
          <Badge variant="outline" className="text-[10px] bg-teal-50">{t("rec.reader.sim")}</Badge>
          <div className="ms-auto flex items-center gap-2">
            <Select value={cardIdx} onValueChange={setCardIdx}>
              <SelectTrigger className="w-28 h-8 text-xs" aria-label={t("rec.reader.card")}><SelectValue /></SelectTrigger>
              <SelectContent>
                {["1", "2", "3", "4"].map((n, i) => <SelectItem key={n} value={String(i)} className="text-xs">{t("rec.reader.card")} {n}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="sm" className="h-9" onClick={readCard} disabled={reading}>{reading ? "…" : t("rec.reader.read")}</Button>
          </div>
        </div>

        {reader?.existing && (
          <div className="rounded-lg border border-teal-300 bg-teal-50/60 dark:bg-teal-950/30 p-3 flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold">{reader.existing.nameAr} <span className="font-mono text-xs text-muted-foreground">{reader.existing.mrn}</span></div>
              <div className="text-xs text-muted-foreground">{t("rec.reader.existsnote")}</div>
            </div>
            <Button size="sm" variant="outline" className="h-9" onClick={() => checkinByCpr(reader.record.idNumber, reader.existing!.nameAr)}>{t("rec.reader.checkin")}</Button>
            <Button size="sm" className="h-9" onClick={() => openFile(reader.existing!.id, reader.existing!.mrn, reader.existing!.nameAr)}>{t("rec.action.open")}</Button>
          </div>
        )}
      </div>

      {/* manual new registration entry */}
      {!mode && !registered && (
        <Button variant="outline" className="h-10 justify-start" onClick={() => { setMode("manual"); setReader(null); }}>
          <Plus className="size-4" aria-hidden />{t("rec.register.manual")}
        </Button>
      )}

      {mode && !registered && (
        <RegisterForm
          mode={mode}
          chip={reader?.record ?? null}
          similarCount={resp?.similar.length ?? 0}
          onCancel={() => { setMode(null); setReader(null); }}
          onRegistered={(r) => { setRegistered(r); setMode(null); setReader(null); }}
        />
      )}

      {registered && (
        <SuccessCard
          reg={registered}
          onCheckinDone={() => setRegistered(null)}
          onBookAnother={() => setRegistered(null)}
        />
      )}

      {/* operational barcode hint for MRN cards */}
      <p className="text-[11px] text-muted-foreground flex items-center gap-2">
        {t("barcode.hint")}
        <Code128 value="BMC-DEMO" height={14} showValue={false} className="inline-block align-middle opacity-60" />
      </p>
    </div>
  );
}
