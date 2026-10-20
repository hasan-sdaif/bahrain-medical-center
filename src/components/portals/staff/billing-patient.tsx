"use client";
/**
 * Patient quick-search picker (agent 2-e) — tries the staff MPI search
 * (GET /api/staff/patients/search); roles without reception/clinical
 * permission (cashier/insurance/collector) fall back to the demo patient
 * directory (/api/patient/login-options) filtered locally.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/i18n";
import { apiGet } from "@/lib/api-client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { UserCheck, Search, UserPlus } from "lucide-react";
import type { PickedPatient } from "./billing-types";

interface SearchHit extends PickedPatient { score?: number; dob?: string }

export function PatientPicker({ selected, onSelect, onClear }: { selected: PickedPatient | null; onSelect: (p: PickedPatient) => void; onClear?: () => void }) {
  const { t, lang } = useI18n();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[] | null>(null);
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
        const d = await apiGet<{ exact: SearchHit[]; similar: SearchHit[] }>(`/api/staff/patients/search?query=${encodeURIComponent(q)}`);
        setFallback(false);
        setHits([...d.exact, ...d.similar]);
      } catch {
        // FORBIDDEN for billing-only roles → demo directory, local filter
        try {
          const dir = await apiGet<PickedPatient[]>("/api/patient/login-options");
          const nq = q.replace(/[أإآ]/g, "ا").toLowerCase();
          setFallback(true);
          setHits(dir.filter((p) =>
            p.nameAr.replace(/[أإآ]/g, "ا").includes(nq)
            || (p.nameEn ?? "").toLowerCase().includes(nq)
            || p.mrn.toLowerCase().includes(nq)
            || (p.phone ?? "").includes(q),
          ));
        } catch { setHits([]); }
      } finally { setBusy(false); }
    }, 350);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [query]);

  const list = useMemo(() => hits ?? [], [hits]);

  if (selected) {
    return (
      <Card className="border-primary/40 bg-primary/5">
        <CardContent className="p-4 flex flex-wrap items-center gap-3">
          <UserCheck className="size-5 text-primary shrink-0" aria-hidden />
          <div className="min-w-0">
            <div className="font-semibold truncate">{lang === "ar" ? selected.nameAr : selected.nameEn || selected.nameAr}</div>
            <div className="text-xs text-muted-foreground font-mono">{selected.mrn}{selected.phone ? ` · ${selected.phone}` : ""}</div>
          </div>
          <Button variant="outline" size="sm" className="ms-auto" onClick={() => { setQuery(""); onClear?.(); }}>
            {t("bc.patient.change")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" aria-hidden />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("search.placeholder")}
          className="ps-9 h-11"
          aria-label={t("bc.patient.pick")}
        />
      </div>
      {fallback && query.trim().length >= 2 && (
        <p className="text-xs text-muted-foreground">ℹ️ {t("bc.patient.directory")}</p>
      )}
      {busy && <div className="space-y-2">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>}
      {!busy && list.length > 0 && (
        <div className="rounded-xl border divide-y max-h-64 overflow-y-auto" role="listbox" aria-label={t("bc.patient.pick")}>
          {list.map((p) => (
            <button
              key={p.id}
              role="option"
              aria-selected={false}
              onClick={() => onSelect({ id: p.id, mrn: p.mrn, nameAr: p.nameAr, nameEn: p.nameEn, phone: p.phone })}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-start hover:bg-muted/60 transition-colors min-h-11"
            >
              <UserPlus className="size-4 text-muted-foreground shrink-0" aria-hidden />
              <span className="text-sm font-medium truncate">{lang === "ar" ? p.nameAr : p.nameEn || p.nameAr}</span>
              <span className="text-xs font-mono text-muted-foreground">{p.mrn}</span>
              {p.score != null && <Badge variant="outline" className="ms-auto font-mono text-[10px] shrink-0">{Math.round(p.score)}%</Badge>}
            </button>
          ))}
        </div>
      )}
      {!busy && query.trim().length >= 2 && list.length === 0 && (
        <p className="text-sm text-muted-foreground py-2">{t("search.empty")}</p>
      )}
    </div>
  );
}
