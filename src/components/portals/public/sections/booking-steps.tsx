"use client";
/** Booking steps 1-3 — department, doctor, and time-slot pickers (slots via API). */
import { useEffect, useMemo, useState } from "react";
import { CalendarX2, Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MoneyText } from "@/components/shared/badges";
import { bi, useI18n } from "@/i18n";
import { apiGet } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { bhDateString, bhTimeString } from "@/lib/bahrain";
import { deptIcon, usePublicData } from "../data";
import { DirArrow } from "../section-shell";
import type { SlotDto } from "./booking";

const DAYS = [0, 1, 2];

export function DeptStep({ selected, onSelect }: { selected: string; onSelect: (code: string) => void }) {
  const { lang, t } = useI18n();
  const { data } = usePublicData();
  return (
    <div role="radiogroup" aria-label={t("public.booking.step.dept")} className="grid gap-3 grid-cols-1 sm:grid-cols-2">
      {data.departments.map((d) => {
        const Icon = deptIcon(d.icon);
        const active = selected === d.code;
        return (
          <button
            key={d.code} role="radio" aria-checked={active} onClick={() => onSelect(d.code)}
            className={cn(
              "flex items-center gap-3 rounded-xl border p-3.5 text-start transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 outline-none min-h-[56px]",
              active ? "border-primary bg-primary/10" : "hover:border-primary/40 hover:bg-muted/50",
            )}
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-lg" style={{ backgroundColor: `${d.color}1a`, color: d.color }}>
              <Icon className="size-5" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block font-medium leading-snug">{bi(lang, d.nameAr, d.nameEn)}</span>
              <span className="block text-xs text-muted-foreground" dir="ltr">{d.code}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function DoctorStep({ deptCode, selected, onChange, onNext, onBack }: {
  deptCode: string; selected: string; onChange: (id: string) => void; onNext: () => void; onBack: () => void;
}) {
  const { lang, t } = useI18n();
  const { data } = usePublicData();
  const doctors = data.doctors.filter((d) => d.deptCode === deptCode);

  const Row = ({ id, title, sub }: { id: string; title: string; sub?: string }) => (
    <button
      role="radio" aria-checked={selected === id} onClick={() => onChange(id)}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl border p-3.5 text-start transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 outline-none min-h-[56px]",
        selected === id ? "border-primary bg-primary/10" : "hover:border-primary/40 hover:bg-muted/50",
      )}
    >
      <span className={cn("grid size-5 shrink-0 place-items-center rounded-full border-2", selected === id ? "border-primary" : "border-muted-foreground/40")}>
        {selected === id ? <span className="size-2.5 rounded-full bg-primary" /> : null}
      </span>
      {id ? (
        <Avatar className="size-9 border">
          <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">{title.replace(/^(د\.|Dr\.)\s*/u, "").slice(0, 2)}</AvatarFallback>
        </Avatar>
      ) : (
        <span className="grid size-9 place-items-center rounded-full bg-muted"><Users className="size-4 text-muted-foreground" aria-hidden /></span>
      )}
      <span className="min-w-0">
        <span className="block font-medium leading-snug">{title}</span>
        {sub ? <span className="block text-xs text-muted-foreground">{sub}</span> : null}
      </span>
    </button>
  );

  return (
    <div>
      <p className="mb-3 text-sm font-semibold text-muted-foreground">{t("public.booking.doctors.in.dept")}</p>
      <div role="radiogroup" aria-label={t("public.booking.step.doctor")} className="space-y-2 max-h-72 overflow-y-auto pe-1">
        <Row id="" title={t("public.booking.any.doctor")} />
        {doctors.map((d) => (
          <Row key={d.id} id={d.id} title={bi(lang, d.nameAr, d.nameEn)} sub={bi(lang, d.specialtyAr, d.specialtyEn) || undefined} />
        ))}
      </div>
      <div className="mt-5 flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={onBack} className="h-11 px-5"><DirArrow back /> {t("common.back")}</Button>
        <Button onClick={onNext} className="h-11 px-6">{t("common.next")} <DirArrow /></Button>
      </div>
    </div>
  );
}

export function SlotStep({ deptCode, doctorId, onPick, onBack }: {
  deptCode: string; doctorId: string; onPick: (s: SlotDto) => void; onBack: () => void;
}) {
  const { lang, t } = useI18n();
  const [day, setDay] = useState(0);
  const [slots, setSlots] = useState<SlotDto[]>([]);
  const [date, setDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);

  useEffect(() => {
    const ctl = new AbortController();
    setLoading(true); setFailed(false); setPicked(null);
    const qs = `dept=${encodeURIComponent(deptCode)}${doctorId ? `&doctor=${encodeURIComponent(doctorId)}` : ""}&day=${day}`;
    apiGet<{ date: string; slots: SlotDto[] }>(`/api/public/slots?${qs}`, ctl.signal)
      .then((r) => { setSlots(r.slots); setDate(r.date); })
      .catch((e: unknown) => { if ((e as Error).name !== "AbortError") setFailed(true); })
      .finally(() => { if (!ctl.signal.aborted) setLoading(false); });
    return () => ctl.abort();
  }, [deptCode, doctorId, day]);

  const byDoctor = useMemo(() => {
    const m = new Map<string, { name: string; list: SlotDto[] }>();
    for (const s of slots) {
      const name = bi(lang, s.doctorAr, s.doctorEn);
      const entry = m.get(s.doctorId) ?? { name, list: [] };
      entry.list.push(s);
      m.set(s.doctorId, entry);
    }
    return [...m.values()];
  }, [slots, lang]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {DAYS.map((d) => (
          <button
            key={d} onClick={() => setDay(d)} aria-pressed={day === d}
            className={cn(
              "h-11 min-w-[88px] rounded-xl border px-4 text-sm font-medium transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 outline-none",
              day === d ? "border-primary bg-primary text-primary-foreground shadow-sm" : "hover:border-primary/40 hover:bg-muted/50",
            )}
          >
            {t(`public.booking.day.${d}`)}
          </button>
        ))}
        {date ? <span className="text-xs text-muted-foreground tabular-nums" dir="ltr">{date}</span> : null}
      </div>

      {loading ? (
        <div className="grid gap-2 grid-cols-3 sm:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-11 rounded-xl" />)}
        </div>
      ) : failed ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">{t("public.booking.slots.error")}</p>
      ) : slots.length === 0 ? (
        <p className="flex items-center justify-center gap-2 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          <CalendarX2 className="size-4" aria-hidden /> {t("public.booking.slots.empty")}
        </p>
      ) : (
        <div className="space-y-4">
          {byDoctor.map((g) => (
            <div key={g.name}>
              {byDoctor.length > 1 ? <p className="mb-2 text-sm font-medium">{g.name}</p> : null}
              <div className="grid gap-2 grid-cols-3 sm:grid-cols-4">
                {g.list.map((s) => {
                  const key = s.at + s.doctorId;
                  const active = picked === key;
                  return (
                    <button
                      key={key}
                      onClick={() => { setPicked(key); onPick(s); }}
                      dir="ltr"
                      className={cn(
                        "h-11 rounded-xl border text-sm font-medium tabular-nums transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 outline-none",
                        active ? "border-primary bg-primary text-primary-foreground shadow-sm" : "hover:border-primary/40 hover:bg-muted/50",
                      )}
                    >
                      {bhTimeString(s.at)}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">
            {t("public.booking.price")}: {slots[0] ? <MoneyText fils={slots[0].priceFils} className="font-semibold text-foreground" /> : null}
          </p>
        </div>
      )}

      <div className="mt-5 flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={onBack} className="h-11 px-5"><DirArrow back /> {t("common.back")}</Button>
        {loading ? <span className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden /> {t("common.loading")}</span> : null}
      </div>
    </div>
  );
}
