"use client";
/**
 * reception-success — post-registration card: MRN + Code128, print card,
 * quick appointment booking (today's slots) and immediate check-in ticket.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { apiGet, apiPost } from "@/lib/api-client";
import { useI18n } from "@/i18n";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Code128 } from "@/components/shared/barcode";
import { MoneyText } from "@/components/shared/badges";
import { CalendarDays, Printer, Ticket, TriangleAlert } from "lucide-react";
import { bhTimeString } from "@/lib/bahrain";
import { DEPARTMENTS, errText, printElement, type CheckinResp, type RegisterResp, type SlotRow } from "./emr-shared";
import { cn } from "@/lib/utils";

export function SuccessCard({ reg, onCheckinDone, onBookAnother }: { reg: RegisterResp; onCheckinDone: () => void; onBookAnother: () => void }) {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const [bookOpen, setBookOpen] = useState(false);
  const [dept, setDept] = useState("GP");
  const [slots, setSlots] = useState<SlotRow[] | null>(null);
  const [slotErr, setSlotErr] = useState<string | null>(null);
  const [booking, setBooking] = useState<string | null>(null);
  const [ticket, setTicket] = useState<CheckinResp | null>(null);
  const [appt, setAppt] = useState<{ id: string; code: string; start: string } | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const loadSlots = useCallback(() => {
    setSlotErr(null); setSlots(null);
    apiGet<{ slots: SlotRow[] }>(`/api/staff/appointments/slots?dept=${dept}&day=0`)
      .then((r) => setSlots(r.slots))
      .catch((e) => setSlotErr(errText(e, lang)));
  }, [dept, lang]);

  useEffect(() => { if (bookOpen) loadSlots(); }, [bookOpen, loadSlots]);

  const book = async (s: SlotRow) => {
    setBooking(s.at);
    try {
      const r = await apiPost<{ id: string; code: string; barcode: string }>("/api/staff/appointments/book", {
        patientId: reg.id, start: s.at, typeCode: s.typeCode, employeeId: s.doctorId,
      });
      setAppt({ id: r.id, code: r.code, start: s.at });
      setBookOpen(false);
      toast({ title: t("rec.book.ok"), description: `${r.code} · ${bhTimeString(s.at)}` });
    } catch (e) {
      toast({ title: t("common.error"), description: errText(e, lang), variant: "destructive" });
    } finally { setBooking(null); }
  };

  const checkinNow = async () => {
    if (!appt) return;
    try {
      const r = await apiPost<CheckinResp>("/api/staff/checkin", { appointmentId: appt.id });
      setTicket(r);
      toast({ title: t("rec.checkin.ok", { name: reg.nameAr }), description: t("rec.checkin.ticket", { code: r.ticket.code }) });
      onCheckinDone();
    } catch (e) {
      toast({ title: t("common.error"), description: errText(e, lang), variant: "destructive" });
    }
  };

  return (
    <div className="grid gap-3">
      {/* printable MRN card */}
      <div ref={printRef} className="print-area rounded-xl border-2 border-teal-700/50 bg-gradient-to-br from-teal-50 to-white dark:from-teal-950/40 dark:to-card p-5 max-w-md">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-[10px] text-muted-foreground">{t("shell.app.name")}</div>
            <div className="font-bold text-base">{reg.nameAr}</div>
          </div>
          <Badge className="bg-emerald-600 border-transparent text-white">{t("rec.card.badge")}</Badge>
        </div>
        <Separator className="my-3" />
        <div className="text-xs text-muted-foreground">{t("patientbanner.mrn")}</div>
        <div className="font-mono text-2xl font-bold tracking-wide" dir="ltr">{reg.mrn}</div>
        <div className="mt-2 bg-white text-black rounded-md px-2 py-1 w-fit">
          <Code128 value={reg.mrn} height={44} />
        </div>
        <div className="mt-2 text-[10px] text-muted-foreground">{t("rec.card.hint")}</div>
      </div>

      {reg.duplicateWarnings.length > 0 && (
        <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/40 p-3 text-xs text-amber-900 dark:text-amber-200 grid gap-1">
          <b className="flex items-center gap-2"><TriangleAlert className="size-4 shrink-0" aria-hidden />{t("rec.duplist.title")}</b>
          {reg.duplicateWarnings.map((w) => (
            <div key={w.id} className="font-mono">{w.mrn} — {w.nameAr} ({Math.round(w.score)}%)</div>
          ))}
          <span>{t("rec.duplist.note")}</span>
        </div>
      )}

      <div className="flex flex-wrap gap-2 no-print">
        <Button className="h-10" onClick={() => printElement(printRef.current)}><Printer className="size-4" aria-hidden />{t("rec.card.print")}</Button>
        <Button variant="outline" className="h-10" onClick={() => setBookOpen(true)}><CalendarDays className="size-4" aria-hidden />{appt ? t("rec.book.another") : t("rec.book.title")}</Button>
        {appt && !ticket && (
          <>
            <Badge variant="outline" className="h-10 px-3 text-xs gap-1 self-center font-mono">{t("rec.book.appt")}: {appt.code} · {bhTimeString(appt.start)}</Badge>
            <Button variant="secondary" className="h-10" onClick={checkinNow}><Ticket className="size-4" aria-hidden />{t("rec.checkin.now")}</Button>
          </>
        )}
      </div>

      {ticket && (
        <div className="rounded-xl border bg-card p-4 max-w-md grid gap-2 no-print">
          <div className="text-sm font-semibold inline-flex items-center gap-2"><Ticket className="size-4 shrink-0" aria-hidden />{t("rec.ticket.issued")}</div>
          <div className="bg-white text-black rounded-md px-2 py-1 w-fit"><Code128 value={ticket.ticket.code} height={40} /></div>
          <div className="text-xs text-muted-foreground">{t("rec.ticket.encounter")}: <span className="font-mono">{ticket.encounter.code}</span> · {t("common.priority")}: {t(`priority.${ticket.ticket.priority}`)}</div>
        </div>
      )}

      <Dialog open={bookOpen} onOpenChange={setBookOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-sm">{t("rec.book.title")}</DialogTitle>
            <DialogDescription className="text-xs">{t("rec.book.desc")}</DialogDescription>
          </DialogHeader>
          <div className="flex gap-1.5 flex-wrap">
            {DEPARTMENTS.map((d) => (
              <button key={d.code} onClick={() => setDept(d.code)}
                className={cn("px-2.5 h-8 rounded-full text-xs border transition-colors", dept === d.code ? "bg-primary text-primary-foreground border-transparent" : "hover:bg-muted")}>
                {lang === "ar" ? d.ar : d.en}
              </button>
            ))}
          </div>
          <ScrollArea className="h-64 rounded-md border">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 p-2">
              {slotErr && <div className="col-span-full text-xs text-red-600 p-2">{slotErr}</div>}
              {!slots && !slotErr && <div className="col-span-full text-xs text-muted-foreground p-2">{t("common.loading")}</div>}
              {slots?.length === 0 && <div className="col-span-full text-xs text-muted-foreground p-2">{t("rec.book.noslots")}</div>}
              {slots?.map((s) => (
                <button key={s.at + s.doctorId} onClick={() => book(s)} disabled={booking === s.at}
                  className="rounded-md border p-2 text-start hover:border-primary hover:bg-primary/5 transition-colors">
                  <div className="font-mono text-sm font-semibold" dir="ltr">{bhTimeString(s.at)}</div>
                  <div className="text-[10px] text-muted-foreground truncate">{s.doctorNameAr}</div>
                  <div className="text-[10px]"><MoneyText fils={s.priceFils} /></div>
                </button>
              ))}
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={onBookAnother}>{t("common.close")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
