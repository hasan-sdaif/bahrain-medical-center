"use client";
/**
 * Overview — Shamel guide dashboard: `.page-head` greeting, `.stat-card` KPI
 * row (upcoming / due invoices / documents / unread), quick actions, upcoming
 * appointments (`.list-item` + `.st-confirmed`), insurance, due invoices,
 * immunizations and latest documents.
 */
import { useI18n, bi } from "@/i18n";
import { apiGet } from "@/lib/api-client";
import { MoneyText, FlagBadges } from "@/components/shared/badges";
import { bhDateString, bhTimeString } from "@/lib/bahrain";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorBox, LoadingRows, SectionCard } from "./parts";
import { PageHead, StatCard, StBadge } from "./shell-ui";
import type { PatientScreen } from "./nav";
import { useFetch, type Appt, type DocItem, type ImmunizationItem, type OverviewPayload } from "./lib";
import {
  BadgeCheck, Bell, CalendarDays, CalendarPlus, CreditCard, FileText, FlaskConical,
  LayoutDashboard, Receipt, Syringe, type LucideIcon,
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
    <li className="list-item">
      <span className="ch-ic ic-teal size-14 shrink-0 flex-col gap-0 leading-none" aria-hidden>
        <span className="num text-sm font-bold">{bhTimeString(a.start).slice(0, 5)}</span>
        <span className="num text-[10px] opacity-80">{bhDateString(a.start).slice(0, 5)}</span>
      </span>
      <span className="li-body">
        <span className="li-title">{bi(lang, a.deptAr, a.deptEn)}</span>
        <span className="li-sub truncate">{bi(lang, a.typeAr, a.typeEn)} · {t("pp.appt.doctor")}: {a.doctorAr}</span>
      </span>
      <span className="li-end"><StBadge status={a.status} /></span>
    </li>
  );
}

/** Immunizations summary (self + guardian dependants) — light endpoint (G1). */
function ImmunizationsCard() {
  const { t, lang } = useI18n();
  const imms = useFetch<ImmunizationItem[]>(() => apiGet<ImmunizationItem[]>("/api/patient/immunizations"));
  const now = Date.now();
  const doseOf = (label: string) => {
    const m = /^الجرعة\s*(\d+)$/.exec(label.trim()) ?? /^(\d+)$/.exec(label.trim());
    return m ? t("pp.imm.doseN", { n: m[1] }) : label;
  };
  return (
    <SectionCard title={t("pp.imm.title")} icon={Syringe} className="lg:col-span-3">
      {imms.loading ? <LoadingRows n={2} h="h-14" /> :
        imms.error ? <ErrorBox error={imms.error} onRetry={imms.reload} className="border-0" /> :
          !imms.data?.length ? <EmptyState icon={Syringe} text={t("pp.imm.empty")} className="py-2" /> : (
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3" role="list">
              {imms.data.slice(0, 6).map((i) => (
                <li key={i.id} className="card p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold">{bi(lang, i.vaccine, i.vaccineEn)}</p>
                    <span className="mono shrink-0 text-xs text-ink-3">{bhDateString(i.givenAt)}</span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-ink-3">
                    <span>{doseOf(i.doseLabel)}</span>
                    <span aria-hidden>·</span>
                    <span className="truncate">{bi(lang, i.ownerAr, i.ownerEn)}</span>
                    {i.nextDueAt && (new Date(i.nextDueAt).getTime() <= now
                      ? <span className="badge b-red ms-auto">{t("pp.imm.overdue")}</span>
                      : <span className="badge b-amber ms-auto">{t("pp.imm.nextDue")}: <span className="mono">{bhDateString(i.nextDueAt)}</span></span>)}
                  </div>
                </li>
              ))}
            </ul>
          )}
      <p className="mt-2 text-xs text-ink-3">{t("pp.imm.note")}</p>
    </SectionCard>
  );
}

export default function OverviewScreen({ data, navigate }: Props) {
  const { t, lang } = useI18n();
  if (!data) return null;
  const p = data.patient;
  const due = data.dueInvoices;
  const next = data.upcoming[0];

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="lg:col-span-3">
        <PageHead
          icon={LayoutDashboard}
          title={t("pp.overview.title")}
          sub={t("pp.overview.sub", { name: p.nameAr.split(" ")[0] })}
          actions={(
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
              <QuickAction icon={CalendarPlus} label={t("pp.qa.book")} onClick={() => navigate("appointments", { book: true })} />
              <QuickAction icon={Syringe} label={t("pp.qa.homedraw")} onClick={() => navigate("homedraw")} />
              <QuickAction icon={FlaskConical} label={t("pp.qa.results")} onClick={() => navigate("results")} />
            </div>
          )}
        />
        <div className="-mt-4">{p.flags?.length ? <FlagBadges flags={p.flags} /> : null}</div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:col-span-3 xl:grid-cols-4">
        <StatCard
          label={t("pp.stat.upcoming")} icon={CalendarDays} tone="ic-teal"
          value={data.upcoming.length} onClick={() => navigate("appointments")}
          delta={next ? t("pp.stat.nextAt", { date: `${bhDateString(next.start)} ${bhTimeString(next.start)}` }) : t("pp.stat.noUpcoming")}
          deltaTone="flat"
        />
        <StatCard
          label={t("pp.stat.due")} icon={Receipt} tone="ic-gold"
          value={due.length} onClick={() => navigate("invoices")}
          delta={due.length ? t("pp.stat.awaitPay") : t("pp.stat.allClear")}
          deltaTone={due.length ? "down" : "up"}
        />
        <StatCard
          label={t("pp.stat.docs")} icon={FileText} tone="ic-violet"
          value={data.documents.length} onClick={() => navigate("documents")}
          delta={t("pp.viewAll")} deltaTone="flat"
        />
        <StatCard
          label={t("pp.stat.unread")} icon={Bell} tone="ic-sky"
          value={data.unreadNotifications} onClick={() => navigate("messages")}
          delta={data.unreadNotifications ? t("pp.stat.newMsgs") : t("pp.stat.noMsgs")}
          deltaTone={data.unreadNotifications ? "down" : "up"}
        />
      </div>

      <SectionCard title={t("pp.overview.insurance")} icon={CreditCard} className="lg:col-span-2">
        {data.insurance ? (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <span className="flex items-center gap-1.5 font-semibold"><BadgeCheck className="size-4 text-primary" aria-hidden />{data.insurance.payerAr}</span>
            <span className="text-ink-3">{t("pp.overview.memberNo")}: <span className="mono">{data.insurance.membershipNo}</span></span>
            <span className="text-ink-3">{t("pp.overview.validUntil")}: <span className="mono">{data.insurance.validUntil ?? "—"}</span></span>
          </div>
        ) : <p className="text-sm text-ink-3">{t("pp.overview.noInsurance")}</p>}
      </SectionCard>

      <SectionCard
        title={t("pp.overview.upcoming")} icon={CalendarDays}
        className="lg:col-span-2"
        contentClassName="p-0"
        action={<Button variant="ghost" size="sm" className="min-h-11" onClick={() => navigate("appointments")}>{t("pp.viewAll")}</Button>}
      >
        {data.upcoming.length ? (
          <ul className="list-group" role="list">{data.upcoming.slice(0, 3).map((a) => <UpcomingRow key={a.id} a={a} />)}</ul>
        ) : (
          <EmptyState icon={FlaskConical} text={t("pp.noUpcoming")} className="py-2" />
        )}
      </SectionCard>

      <SectionCard title={t("pp.overview.due")} icon={Receipt}>
        {due.length ? (
          <ul className="grid gap-2" role="list">
            {due.map((i) => (
              <li key={i.id} className="card interactive p-3" >
                <div className="flex items-center justify-between gap-2">
                  <span className="mono text-xs">{i.code}</span>
                  <StBadge status={i.status} />
                </div>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <MoneyText fils={i.patientFils} className="text-sm font-bold" />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex items-center justify-between gap-2 card p-3 text-sm text-ink-3">
            <span>{t("pp.inv.empty")}</span>
            <span className="badge b-green">{t("status.paid")}</span>
          </div>
        )}
        <Button variant="outline" size="sm" className="mt-3 min-h-11 w-full" onClick={() => navigate("invoices")}>{t("pp.inv.title")}</Button>
      </SectionCard>

      <ImmunizationsCard />

      <SectionCard
        title={t("pp.overview.docs")} icon={FileText}
        className="lg:col-span-3" contentClassName="p-0"
        action={<Button variant="ghost" size="sm" className="min-h-11" onClick={() => navigate("documents")}>{t("pp.viewAll")}</Button>}
      >
        {data.documents.length ? (
          <ul className="list-group" role="list">
            {data.documents.slice(0, 6).map((d: DocItem) => (
              <li key={d.id} className="list-item">
                <span className="ch-ic ic-violet shrink-0" aria-hidden><FileText className="size-4" /></span>
                <span className="li-body">
                  <span className="li-title truncate">{bi(lang, d.titleAr, d.titleEn)}</span>
                  <span className="li-sub mono">{d.issuedAt}</span>
                </span>
              </li>
            ))}
          </ul>
        ) : <EmptyState text={t("pp.doc.empty")} className="py-2" />}
      </SectionCard>

      <p className="text-center text-xs text-ink-3 lg:col-span-3">{t("barcode.hint")}</p>
    </div>
  );
}
