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
import { MoneyText, StatusBadge } from "@/components/shared/badges";
import { bhDateString, bhTimeString } from "@/lib/bahrain";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { BarcodeBlock, EmptyState, ErrorBox, LoadingRows, SectionCard } from "./parts";
import { errText, useFetch, type Appt } from "./lib";
import BookDialog from "./book-dialog";
import { CalendarDays, CalendarPlus, Info, Stethoscope, UtensilsCrossed, XCircle } from "lucide-react";

function ApptCard({ a, onCancel }: { a: Appt; onCancel: (a: Appt) => void }) {
  const { t, lang } = useI18n();
  const canCancel = ["requested", "confirmed"].includes(a.status) && new Date(a.start).getTime() > Date.now();
  const prep = bi(lang, a.prepAr, a.prepEn);
  return (
    <li className="grid gap-3 rounded-2xl border p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold">{bi(lang, a.deptAr, a.deptEn)}</p>
          <p className="text-sm text-muted-foreground">{bi(lang, a.typeAr, a.typeEn)}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={a.status} />
          <span className="rounded-lg bg-muted px-2 py-1 text-xs font-semibold" dir="ltr">{bhDateString(a.start)} · {bhTimeString(a.start)}</span>
        </div>
      </div>
      <p className="flex items-center gap-1.5 text-sm"><Stethoscope className="size-4 text-primary" aria-hidden />{t("pp.appt.doctor")}: {bi(lang, a.doctorAr, a.doctorEn ?? a.doctorAr)}</p>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="flex items-center gap-1.5"><MoneyText fils={a.priceFils} /> · {t("pp.appt.payment")}: <StatusBadge status={a.paymentStatus} /></span>
        <span className="font-mono text-xs text-muted-foreground" dir="ltr">{a.code}</span>
      </div>
      {prep ? (
        <p className="flex items-start gap-1.5 rounded-lg bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <UtensilsCrossed className="mt-0.5 size-3.5 shrink-0" aria-hidden />{t("pp.appt.prep")}: {prep}
        </p>
      ) : null}
      <BarcodeBlock value={a.barcode} hint={t("pp.appt.barcodeHint")} />
      {canCancel ? (
        <Button variant="outline" size="sm" className="min-h-11 w-full text-destructive sm:w-auto sm:justify-self-end" onClick={() => onCancel(a)}>
          <XCircle className="size-4" aria-hidden />{t("pp.appt.cancel")}
        </Button>
      ) : null}
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 text-xl font-bold"><CalendarDays className="size-5 text-primary" aria-hidden />{t("pp.appt.title")}</h1>
        <Button onClick={() => setBookOpen(true)} className="min-h-11"><CalendarPlus className="size-4" aria-hidden />{t("pp.appt.book")}</Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "upcoming" | "past")}>
        <TabsList className="w-full">
          <TabsTrigger value="upcoming" className="min-h-9 flex-1">{t("pp.appt.upcoming")}</TabsTrigger>
          <TabsTrigger value="past" className="min-h-9 flex-1">{t("pp.appt.past")}</TabsTrigger>
        </TabsList>
      </Tabs>

      {list.loading ? <LoadingRows n={3} h="h-44" /> : list.error ? <ErrorBox error={list.error} onRetry={list.reload} /> : (
        <SectionCard>
          {rows.length ? (
            <ul className="grid gap-3" role="list">{rows.map((a) => <ApptCard key={a.id} a={a} onCancel={setCancelTarget} />)}</ul>
          ) : <EmptyState icon={CalendarDays} text={t("pp.appt.empty")} />}
          <p className="mt-3 flex items-start gap-1.5 text-xs text-muted-foreground"><Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />{t("pp.book.keepBarcode")}</p>
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
