"use client";
/**
 * Section 2 — سجل التدقيق (Shamel guide admin/audit): GET
 * /api/staff/audit/search (action select + patientId filter, client
 * pagination over the server's take-50 window) + GET /api/staff/audit/chain
 * hash-chain verification alert + explanation card. Shamel .table styling.
 */
import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/i18n";
import { apiGet } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { bhDateString, bhTimeString } from "@/lib/bahrain";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Eye, Link2, Lock, ScrollText, Search, ShieldCheck, ShieldX } from "lucide-react";
import { ErrCard, type AuditRow, type ChainResp } from "./bits";

const ACTIONS = ["view-chart", "create", "sign", "payment", "reader-read", "checkin", "wo-close", "merge", "break-glass", "dispense", "patient-search", "audit-search", "kiosk-checkin", "verify-doc", "recall"];
const PAGE_SIZE = 10;

export default function AdminAudit() {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const [action, setAction] = useState("all");
  const [patientId, setPatientId] = useState("");
  const [rows, setRows] = useState<AuditRow[] | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const [page, setPage] = useState(0);
  const [chain, setChain] = useState<ChainResp | null>(null);
  const [chainErr, setChainErr] = useState<unknown>(null);
  const [chainBusy, setChainBusy] = useState(false);

  const search = useCallback(async (a: string, p: string) => {
    setErr(null);
    const q = new URLSearchParams();
    if (a && a !== "all") q.set("action", a);
    if (p.trim()) q.set("patientId", p.trim());
    try {
      setRows(await apiGet<AuditRow[]>(`/api/staff/audit/search${q.size ? `?${q.toString()}` : ""}`));
      setPage(0);
    } catch (e) {
      setErr(e);
      setRows(null);
    }
  }, []);

  const verifyChain = useCallback(async () => {
    setChainBusy(true);
    setChainErr(null);
    try {
      const c = await apiGet<ChainResp>("/api/staff/audit/chain");
      setChain(c);
      toast({ title: c.ok ? t("admin.audit.chain.ok", { n: c.checked }) : t("admin.audit.chain.broken", { id: c.brokenAt ?? "—", n: c.checked }), variant: c.ok ? "default" : "destructive" });
    } catch (e) {
      setChainErr(e);
    }
    setChainBusy(false);
  }, [t, toast]);

  useEffect(() => {
    queueMicrotask(() => {
      void search("all", "");
      void verifyChain();
    });
  }, [search, verifyChain]);

  const pages = rows ? Math.max(1, Math.ceil(rows.length / PAGE_SIZE)) : 1;
  const slice = rows?.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE) ?? [];

  return (
    <div className="stack-sm">
      {chainErr ? (
        <ErrCard err={chainErr} onRetry={() => void verifyChain()} />
      ) : !chain ? (
        <Skeleton className="h-16 rounded-xl" />
      ) : (
        <div className={cn("alert", chain.ok ? "alert-success" : "alert-danger")} aria-label={t("admin.audit.chain.title")}>
          <span className="al-ic">
            {chain.ok
              ? <ShieldCheck className="size-6" aria-hidden />
              : <ShieldX className="size-6" aria-hidden />}
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="sr-only">{t("admin.audit.chain.title")}</h3>
            <p className="font-medium">
              {chain.ok
                ? t("admin.audit.chain.ok", { n: chain.checked })
                : t("admin.audit.chain.broken", { id: chain.brokenAt ?? "—", n: chain.checked })}
            </p>
          </div>
          <Button size="sm" variant="outline" className="h-9 shrink-0" disabled={chainBusy} onClick={() => void verifyChain()}>
            <Link2 className="size-3.5" aria-hidden /> {chainBusy ? t("admin.audit.chain.checking") : t("admin.audit.chain.run")}
          </Button>
        </div>
      )}

      <div className="card p-0">
        <div className="card-head">
          <span className="ch-title">
            <span className="ch-ic"><ScrollText className="size-4" aria-hidden /></span>
            {t("admin.audit.searchTitle")}
          </span>
        </div>
        <div className="card-body grid gap-3">
          <form
            className="flex flex-wrap items-center gap-2"
            aria-label={t("admin.audit.filter.title")}
            onSubmit={(e) => { e.preventDefault(); void search(action, patientId); }}
          >
            <div className="w-full sm:w-56">
              <Select value={action} onValueChange={setAction}>
                <SelectTrigger className="h-11 w-full" aria-label={t("audit.action")}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("admin.audit.filter.actionAll")}</SelectItem>
                  {ACTIONS.map((a) => <SelectItem key={a} value={a}><span className="mono text-xs">{a}</span></SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Input
              className="mono h-11 w-full sm:w-64"
              placeholder={t("admin.audit.filter.patient")}
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              aria-label={t("admin.audit.filter.patient")}
            />
            <Button type="submit" className="h-11"><Search className="size-4" aria-hidden /> {t("common.apply")}</Button>
          </form>

          {err ? <ErrCard err={err} onRetry={() => void search(action, patientId)} /> : !rows ? (
            <div className="grid gap-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-11 rounded-lg" />)}</div>
          ) : rows.length === 0 ? (
            <div className="empty-state">
              <span className="es-ic"><ScrollText className="size-9" aria-hidden /></span>
              <p>{t("admin.audit.empty")}</p>
            </div>
          ) : (
            <>
              <div className="table-wrap max-h-96 overflow-y-auto rounded-lg border">
                <table className="table sticky-head sm">
                  <thead>
                    <tr>
                      <th>{t("common.time")}</th>
                      <th>{t("audit.actor")}</th>
                      <th>{t("audit.action")}</th>
                      <th>{t("audit.resource")}</th>
                      <th>{t("common.reason")}</th>
                      <th>{t("admin.audit.col.hash")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {slice.map((r) => (
                      <tr key={r.id}>
                        <td className="num-cell whitespace-nowrap text-xs">{bhDateString(r.at)} {bhTimeString(r.at)}</td>
                        <td className="max-w-36">
                          <div className="mono cell-main truncate text-xs" dir="ltr">{r.actorId ?? "system"}</div>
                          {r.actorRole && (
                            <span className="badge b-slate sm mt-0.5">
                              {t(`staff.role.${r.actorRole}`) !== `staff.role.${r.actorRole}` ? t(`staff.role.${r.actorRole}`) : r.actorRole}
                            </span>
                          )}
                        </td>
                        <td><span className="badge b-teal sm"><span className="mono">{r.action}</span></span></td>
                        <td>
                          <div className="cell-main text-xs">{r.resource}</div>
                          {r.resourceId && <div className="mono cell-sub max-w-28 truncate" dir="ltr">{r.resourceId}</div>}
                        </td>
                        <td className="max-w-32 text-xs"><div className="truncate">{r.reason ?? "—"}</div></td>
                        <td className="mono text-[10px] text-ink-3" dir="ltr">{r.hash}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-ink-3">{t("admin.audit.pageInfo", { page: page + 1, pages, count: rows.length })}</p>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="outline" className="h-9" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                    {lang === "ar" ? <ChevronRight className="size-3.5" aria-hidden /> : <ChevronLeft className="size-3.5" aria-hidden />} {t("common.prev")}
                  </Button>
                  <Button size="sm" variant="outline" className="h-9" disabled={page >= pages - 1} onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}>
                    {t("common.next")} {lang === "ar" ? <ChevronLeft className="size-3.5" aria-hidden /> : <ChevronRight className="size-3.5" aria-hidden />}
                  </Button>
                </div>
              </div>
              <p className="text-[11px] text-ink-3">{t("admin.audit.take50")}</p>
            </>
          )}
        </div>
      </div>

      <div className="card p-0">
        <div className="card-head">
          <span className="ch-title">
            <span className="ch-ic"><Lock className="size-4" aria-hidden /></span>
            {t("admin.audit.chain.explain")}
          </span>
        </div>
        <div className="list-group">
          {[
            { icon: Lock, text: t("admin.audit.chain.exp1") },
            { icon: Link2, text: t("admin.audit.chain.exp2") },
            { icon: Eye, text: t("admin.audit.chain.exp3") },
          ].map(({ icon: Icon, text }, i) => (
            <div key={i} className="list-item">
              <span className="ch-ic shrink-0"><Icon className="size-4" aria-hidden /></span>
              <span className="li-body"><span className="li-sub text-sm leading-relaxed">{text}</span></span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
