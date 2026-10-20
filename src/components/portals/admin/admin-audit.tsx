"use client";
/**
 * Tab 2 — سجل التدقيق: GET /api/staff/audit/search (action select + patientId
 * filter, client pagination over the server's take-50 window) + GET
 * /api/staff/audit/chain hash-chain verification banner + explanation card.
 */
import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/i18n";
import { apiGet } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { bhDateString, bhTimeString } from "@/lib/bahrain";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Eye, Link2, Lock, ScrollText, Search, ShieldCheck, ShieldX } from "lucide-react";
import { ErrCard, Section, type AuditRow, type ChainResp } from "./bits";

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
    <Section title={t("admin.tab.audit")} sub={t("admin.audit.sub")}>
      {chainErr ? (
        <ErrCard err={chainErr} onRetry={() => void verifyChain()} />
      ) : !chain ? (
        <Skeleton className="h-16" />
      ) : (
        <div className={cn("rounded-xl border-2 p-4 flex flex-wrap items-center gap-3", chain.ok ? "border-emerald-500/60 bg-emerald-500/5" : "border-red-500/60 bg-red-500/5")} aria-label={t("admin.audit.chain.title")}>
          <h3 className="sr-only">{t("admin.audit.chain.title")}</h3>
          {chain.ok ? <ShieldCheck className="size-6 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden /> : <ShieldX className="size-6 text-red-600 dark:text-red-400 shrink-0" aria-hidden />}
          <p className={cn("text-sm font-medium flex-1 min-w-0", chain.ok ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300")}>
            {chain.ok
              ? t("admin.audit.chain.ok", { n: chain.checked })
              : t("admin.audit.chain.broken", { id: chain.brokenAt ?? "—", n: chain.checked })}
          </p>
          <Button size="sm" variant="outline" className="h-8 shrink-0" disabled={chainBusy} onClick={() => void verifyChain()}>
            <Link2 className="size-3.5" /> {chainBusy ? t("admin.audit.chain.checking") : t("admin.audit.chain.run")}
          </Button>
        </div>
      )}

      <Card className="p-0">
        <CardHeader className="py-3 px-4 bg-muted/50">
          <CardTitle className="text-sm flex items-center gap-2"><ScrollText className="size-4 text-primary" aria-hidden /> {t("admin.audit.searchTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="p-4 grid gap-3">
          <form className="flex flex-wrap items-end gap-2" aria-label={t("admin.audit.filter.title")} onSubmit={(e) => { e.preventDefault(); void search(action, patientId); }}>
            <div className="w-full sm:w-56">
              <Select value={action} onValueChange={setAction}>
                <SelectTrigger className="w-full h-10" aria-label={t("audit.action")}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("admin.audit.filter.actionAll")}</SelectItem>
                  {ACTIONS.map((a) => <SelectItem key={a} value={a}><span className="font-mono text-xs">{a}</span></SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Input
              className="w-full sm:w-64 h-10 font-mono"
              placeholder={t("admin.audit.filter.patient")}
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              aria-label={t("admin.audit.filter.patient")}
            />
            <Button type="submit" className="h-10"><Search className="size-4" /> {t("common.apply")}</Button>
          </form>

          {err ? <ErrCard err={err} onRetry={() => void search(action, patientId)} /> : !rows ? (
            <div className="grid gap-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">{t("admin.audit.empty")}</p>
          ) : (
            <>
              <div className="max-h-96 overflow-y-auto rounded-lg border">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead className="text-start">{t("common.time")}</TableHead>
                      <TableHead className="text-start">{t("audit.actor")}</TableHead>
                      <TableHead className="text-start">{t("audit.action")}</TableHead>
                      <TableHead className="text-start">{t("audit.resource")}</TableHead>
                      <TableHead className="text-start">{t("common.reason")}</TableHead>
                      <TableHead className="text-start">{t("admin.audit.col.hash")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {slice.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="whitespace-nowrap font-mono text-xs" dir="ltr">{bhDateString(r.at)} {bhTimeString(r.at)}</TableCell>
                        <TableCell className="max-w-36">
                          <div className="truncate font-mono text-xs" dir="ltr">{r.actorId ?? "system"}</div>
                          {r.actorRole && <Badge variant="outline" className="text-[9px] mt-0.5">{t(`staff.role.${r.actorRole}`) !== `staff.role.${r.actorRole}` ? t(`staff.role.${r.actorRole}`) : r.actorRole}</Badge>}
                        </TableCell>
                        <TableCell><Badge className="font-mono text-[10px] bg-teal-100 text-teal-900 dark:bg-teal-950 dark:text-teal-200 border-transparent">{r.action}</Badge></TableCell>
                        <TableCell className="text-xs">
                          <div>{r.resource}</div>
                          {r.resourceId && <div className="font-mono text-[10px] text-muted-foreground truncate max-w-28" dir="ltr">{r.resourceId}</div>}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-32"><div className="truncate">{r.reason ?? "—"}</div></TableCell>
                        <TableCell className="font-mono text-[10px] text-muted-foreground" dir="ltr">{r.hash}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">{t("admin.audit.pageInfo", { page: page + 1, pages, count: rows.length })}</p>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="outline" className="h-8" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                    {lang === "ar" ? <ChevronRight className="size-3.5" /> : <ChevronLeft className="size-3.5" />} {t("common.prev")}
                  </Button>
                  <Button size="sm" variant="outline" className="h-8" disabled={page >= pages - 1} onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}>
                    {t("common.next")} {lang === "ar" ? <ChevronLeft className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                  </Button>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">{t("admin.audit.take50")}</p>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="p-0">
        <CardHeader className="py-3 px-4 bg-muted/50">
          <CardTitle className="text-sm flex items-center gap-2"><Lock className="size-4 text-primary" aria-hidden /> {t("admin.audit.chain.explain")}</CardTitle>
        </CardHeader>
        <CardContent className="p-4 grid gap-2.5">
          {[
            { icon: Lock, text: t("admin.audit.chain.exp1") },
            { icon: Link2, text: t("admin.audit.chain.exp2") },
            { icon: Eye, text: t("admin.audit.chain.exp3") },
          ].map(({ icon: Icon, text }, i) => (
            <div key={i} className="flex items-start gap-2.5 text-sm">
              <Icon className="size-4 text-primary mt-0.5 shrink-0" aria-hidden />
              <span>{text}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </Section>
  );
}
