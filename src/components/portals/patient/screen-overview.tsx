"use client";
/**
 * Overview — greeting, insurance summary, quick actions, upcoming appointments
 * (barcode preview), due invoices, unread notifications, latest documents.
 */
import { useI18n, bi } from "@/i18n";
import { MoneyText, StatusBadge, FlagBadges } from "@/components/shared/badges";
import { bhDateString, bhTimeString } from "@/lib/bahrain";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { EmptyState, SectionCard } from "./parts";
import type { PatientScreen } from "./nav";
import type { Appt, DocItem, OverviewPayload } from "./lib";
import {
  BadgeCheck, Bell, CalendarDays, CalendarPlus, CreditCard, FileText, FlaskConical,
  Receipt, Syringe, type LucideIcon,
} from "lucide-react";

interface Props {
  data: OverviewPayload | null;
  reload: () => void;
  navigate: (s: PatientScreen, opts?: { book?: boolean }) => void;
}

function QuickAction({ icon: Icon, label, onClick }: { icon: LucideIcon; label: string; onClick: () => void }) {
  return (
    <Button variant="outline" onClick={onClick} className="flex h-auto min-h-11 flex-1 flex-col items-center gap-1 rounded-xl px-3 py-2.5 text-xs font-medium">
      <Icon className="size-5 text-primary" aria-hidden />
      <span className="truncate">{label}</span>
    </Button>
  );
}

function UpcomingRow({ a }: { a: Appt }) {
  const { lang, t } = useI18n();
  return (
    <li className="flex items-center gap-3 rounded-xl border p-3">
      <div className="flex w-14 shrink-0 flex-col items-center rounded-lg bg-primary/10 py-1.5 text-primary">
        <span className="text-sm font-bold leading-none">{bhTimeString(a.start).slice(0, 5)}</span>
        <span className="mt-1 text-[10px] leading-none opacity-80">{bhDateString(a.start).slice(0, 5)}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{bi(lang, a.deptAr, a.deptEn)}</p>
        <p className="truncate text-xs text-muted-foreground">{bi(lang, a.typeAr, a.typeEn)} · {t("pp.appt.doctor")}: {a.doctorAr}</p>
      </div>
      <StatusBadge status={a.status} />
    </li>
  );
}

export default function OverviewScreen({ data, navigate }: Props) {
  const { t, lang } = useI18n();
  if (!data) return null;
  const p = data.patient;
  const due = data.dueInvoices;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <section aria-label={t("pp.overview.quick")} className="lg:col-span-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold">{t("pp.hello", { name: p.nameAr.split(" ")[0] })}</h1>
            <div className="mt-1"><FlagBadges flags={p.flags} /></div>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <QuickAction icon={CalendarPlus} label={t("pp.qa.book")} onClick={() => navigate("appointments", { book: true })} />
          <QuickAction icon={Syringe} label={t("pp.qa.homedraw")} onClick={() => navigate("homedraw")} />
          <QuickAction icon={FlaskConical} label={t("pp.qa.results")} onClick={() => navigate("results")} />
        </div>
      </section>

      <SectionCard title={t("pp.overview.insurance")} icon={CreditCard} className="lg:col-span-2">
        {data.insurance ? (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <span className="flex items-center gap-1.5 font-semibold"><BadgeCheck className="size-4 text-primary" aria-hidden />{data.insurance.payerAr}</span>
            <span className="text-muted-foreground">{t("pp.overview.memberNo")}: <span className="font-mono" dir="ltr">{data.insurance.membershipNo}</span></span>
            <span className="text-muted-foreground">{t("pp.overview.validUntil")}: <span className="font-mono" dir="ltr">{data.insurance.validUntil ?? "—"}</span></span>
          </div>
        ) : <p className="text-sm text-muted-foreground">{t("pp.overview.noInsurance")}</p>}
      </SectionCard>

      <SectionCard title={t("pp.overview.unread")} icon={Bell} contentClassName="flex items-center gap-3">
        <span className="text-3xl font-bold text-primary tabular-nums">{data.unreadNotifications}</span>
        <Button variant="ghost" size="sm" className="min-h-11" onClick={() => navigate("messages")}>{t("pp.viewAll")}</Button>
      </SectionCard>

      <SectionCard
        title={t("pp.overview.upcoming")} icon={CalendarDays}
        className="lg:col-span-2" action={<Button variant="ghost" size="sm" className="min-h-11" onClick={() => navigate("appointments")}>{t("pp.viewAll")}</Button>}
      >
        {data.upcoming.length ? (
          <ul className="grid gap-2" role="list">{data.upcoming.slice(0, 3).map((a) => <UpcomingRow key={a.id} a={a} />)}</ul>
        ) : (
          <EmptyState icon={FlaskConical} text={t("pp.noUpcoming")} className="border-0 py-2" />
        )}
      </SectionCard>

      <SectionCard title={t("pp.overview.due")} icon={Receipt}>
        {due.length ? (
          <ul className="grid gap-2" role="list">
            {due.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-2 rounded-xl border p-3">
                <span className="font-mono text-xs" dir="ltr">{i.code}</span>
                <span className="flex items-center gap-2"><MoneyText fils={i.patientFils} className="text-sm font-semibold" /><StatusBadge status={i.status} /></span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex items-center justify-between gap-2 rounded-xl border p-3 text-sm text-muted-foreground">
            <span>{t("pp.inv.empty")}</span>
            <Badge variant="secondary" className="border-transparent bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">{t("status.paid")}</Badge>
          </div>
        )}
        <Button variant="outline" size="sm" className="mt-2 min-h-11 w-full" onClick={() => navigate("invoices")}>{t("pp.inv.title")}</Button>
      </SectionCard>

      <SectionCard
        title={t("pp.overview.docs")} icon={FileText}
        className="lg:col-span-3" action={<Button variant="ghost" size="sm" className="min-h-11" onClick={() => navigate("documents")}>{t("pp.viewAll")}</Button>}
      >
        {data.documents.length ? (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3" role="list">
            {data.documents.slice(0, 6).map((d: DocItem) => (
              <li key={d.id} className="flex items-center justify-between gap-2 rounded-xl border p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{bi(lang, d.titleAr, d.titleEn)}</p>
                  <p className="text-xs text-muted-foreground" dir="ltr">{d.issuedAt}</p>
                </div>
                <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              </li>
            ))}
          </ul>
        ) : <EmptyState text={t("pp.doc.empty")} className="border-0 py-2" />}
      </SectionCard>

      <Separator className="lg:col-span-3" />
      <p className="text-center text-xs text-muted-foreground lg:col-span-3">{t("barcode.hint")}</p>
    </div>
  );
}
