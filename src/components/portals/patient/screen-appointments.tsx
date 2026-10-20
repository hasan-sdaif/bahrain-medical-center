"use client";
/**
 * Appointments — upcoming/past list with check-in barcode (Code128), prep
 * instructions, price & payment status, cancel (4h window errors surfaced),
 * and the new-booking flow dialog.
 */
import { useEffect, useState } from "react";
import { useI18n, bi } from "@/i18n";
import { apiGet, apiPost } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import { MoneyText } from "@/components/shared/badges";
import { bhDateString, bhTimeString } from "@/lib/bahrain";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { BarcodeBlock, EmptyState, ErrorBox, LoadingRows, SectionCard } from "./parts";
import { PageHead, StBadge, TimeChip } from "./shell-ui";
import { errText, useFetch, type Appt } from "./lib";
import BookDialog from "./book-dialog";
import { CalendarDays, CalendarPlus, Info, Stethoscope, UtensilsCrossed, XCircle } from "lucide-react";

function ApptCard({ a, onCancel }: { a: Appt; onCancel: (a: Appt) => void }) {
  const { t, lang } = useI18n();
  const canCancel = ["requested", "confirmed"].includes(a.status) && new Date(a.start).getTime() > Date.now();
  const prep = bi(lang, a.prepAr, a.prepEn);
  return (
    <li className="card">
      <div className="card-head">
        <div className="ch-title">
          <span className="ch-ic ic-teal" aria-hidden><CalendarDays className="size-4" /></span>
          <span className="min-w-0">
            <span className="block truncate">{bi(lang, a.deptAr, a.deptEn)}</span>
            <span className="ch-sub block truncate">{bi(lang, a.typeAr, a.typeEn)}</span>
          </span>
        </div>
        <div className="ch-tools">
          <TimeChip>{bhDateString(a.start)} · {bhTimeString(a.start)}</TimeChip>
          <StBadge status={a.status} />
        </div>
      </div>
      <div className="card-body grid gap-3">
        <p className="flex items-center gap-1.5 text-sm"><Stethoscope className="size-4 text-primary" aria-hidden />{t("pp.appt.doctor")}: {bi(lang, a.doctorAr, a.doctorEn ?? a.doctorAr)}</p>
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="flex items-center gap-1.5"><MoneyText fils={a.priceFils} /> · {t("pp.appt.payment")}: <StBadge status={a.paymentStatus} /></span>
          <span className="mono text-xs text-ink-3">{a.code}</span>
        </div>
        {prep ? (
          <p className="alert alert-warning items-start p-2.5 text-xs" role="note">
            <UtensilsCrossed className="al-ic size-4 shrink-0" aria-hidden />{t("pp.appt.prep")}: {prep}
          </p>
        ) : null}
        <BarcodeBlock value={a.barcode} hint={t("pp.appt.barcodeHint")} />
        {canCancel ? (
          <Button variant="outline" size="sm" className="min-h-11 w-full text-destructive sm:w-auto sm:justify-self-end" onClick={() => onCancel(a)}>
            <XCircle className="size-4" aria-hidden />{t("pp.appt.cancel")}
          </Button>
        ) : null}
      </div>
    </li>
  );
}

export default function AppointmentsScreen({ bookSignal }: { bookSignal: number }) {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const [bookOpen, setBookOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<Appt | null>(null);
  const [cancelBusy, setCancelBusy] = useState(false);
  const list = useFetch<Appt[]>(() => apiGet<Appt[]>("/api/patient/appointments"));

  useEffect(() => { if (bookSignal > 0) setBookOpen(true); }, [bookSignal]);

  const upcoming = (list.data ?? []).filter((a) => new Date(a.start) >= new Date() && !["cancelled", "no-show", "completed"].includes(a.status));
  const past = (list.data ?? []).filter((a) => !upcoming.includes(a));
  const rows = tab === "upcoming" ? upcoming : past;

  const doCancel = async () => {
    if (!cancelTarget) return;
    setCancelBusy(true);
    try {
      await apiPost("/api/patient/appointments/cancel", { appointmentId: cancelTarget.id });
      toast({ title: t("pp.appt.canceled"), description: cancelTarget.code });
      list.reload();
    } catch (e) {
      toast({ title: t("common.error"), description: errText(e, lang), variant: "destructive" });
    } finally {
      setCancelBusy(false);
      setCancelTarget(null);
    }
  };

  return (
    <div className="grid gap-4">
      <PageHead
        icon={CalendarDays} title={t("pp.appt.title")} sub={t("pp.appt.sub")}
        actions={<Button onClick={() => setBookOpen(true)} className="min-h-11"><CalendarPlus className="size-4" aria-hidden />{t("pp.appt.book")}</Button>}
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as "upcoming" | "past")}>
        <TabsList className="w-full">
          <TabsTrigger value="upcoming" className="min-h-9 flex-1">{t("pp.appt.upcoming")}</TabsTrigger>
          <TabsTrigger value="past" className="min-h-9 flex-1">{t("pp.appt.past")}</TabsTrigger>
        </TabsList>
      </Tabs>

      {list.loading ? <LoadingRows n={3} h="h-44" /> : list.error ? <ErrorBox error={list.error} onRetry={list.reload} /> : (
        <SectionCard contentClassName="p-0">
          {rows.length ? (
            <ul className="list-group gap-3 p-4" role="list">{rows.map((a) => <ApptCard key={a.id} a={a} onCancel={setCancelTarget} />)}</ul>
          ) : <EmptyState icon={CalendarDays} text={t("pp.appt.empty")} />}
          <p className="flex items-start gap-1.5 border-t border-line px-4 py-3 text-xs text-ink-3"><Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />{t("pp.book.keepBarcode")}</p>
        </SectionCard>
      )}

      <BookDialog open={bookOpen} onOpenChange={setBookOpen} onBooked={list.reload} />

      <AlertDialog open={!!cancelTarget} onOpenChange={(o) => !o && setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("pp.appt.cancel")}</AlertDialogTitle>
            <AlertDialogDescription>{t("pp.appt.cancelConfirm")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11" disabled={cancelBusy}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction className="min-h-11" onClick={(e) => { e.preventDefault(); void doCancel(); }} disabled={cancelBusy}>{t("common.confirm")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
