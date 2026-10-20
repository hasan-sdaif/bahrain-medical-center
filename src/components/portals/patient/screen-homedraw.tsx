"use client";
/**
 * Home draw — request form (tests multi-select chips, governorate zone with
 * fee, morning/evening slot with surcharge, address, fasting, collector
 * gender preference → POST /api/patient/home-request) + live tracking cards
 * with the requested→delivered status timeline.
 */
import { useState } from "react";
import { useI18n, bi } from "@/i18n";
import { apiGet, apiPost } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import { BHD3 } from "@/lib/money";
import { bhDateString, bhTimeString } from "@/lib/bahrain";
import { MoneyText } from "@/components/shared/badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, ErrorBox, LoadingRows, SectionCard } from "./parts";
import { PageHead, StBadge, TimeChip } from "./shell-ui";
import { errText, useFetch, HOME_FLOW, HOME_TESTS, HOME_ZONES, type HomeTrack } from "./lib";
import { Check, Loader2, MapPin, Send, Syringe, UtensilsCrossed } from "lucide-react";

/** wire values contain the Arabic marker the server matches for the evening surcharge */
const SLOT_OPTS = [
  { value: "صباحاً 07:30-10:00", labelKey: "pp.hd.slotMorning", evening: false },
  { value: "مساءً 16:00-19:00", labelKey: "pp.hd.slotEvening", evening: true },
];

function TrackCard({ r }: { r: HomeTrack }) {
  const { t, lang } = useI18n();
  const idx = HOME_FLOW.indexOf(r.status);
  const fastingTest = r.tests.some((x) => x.fasting);
  return (
    <li className="card">
      <div className="card-head">
        <div className="ch-title">
          <span className="ch-ic ic-teal" aria-hidden><Syringe className="size-4" /></span>
          <span className="mono">{r.code}</span>
        </div>
        <div className="ch-tools">
          <TimeChip>{bhDateString(r.createdAt)}</TimeChip>
          <StBadge status={r.status} />
        </div>
      </div>
      <div className="card-body grid gap-3">
        <div className="flex flex-wrap gap-1" aria-label={t("pp.hd.flow")}>
          {HOME_FLOW.map((s, i) => (
            <span key={s} className={
              i < idx ? "badge b-green"
                : i === idx ? "badge st-progress"
                  : "badge b-slate"
            }>
              {i < idx ? <Check className="size-3" aria-hidden /> : i === idx ? <span className="dot" aria-hidden /> : null}
              {t(`status.${s}`)}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {r.tests.map((x) => (
            <span key={x.code} className="tag">{bi(lang, x.nameAr, x.nameEn ?? x.nameAr)} · <MoneyText fils={x.priceFils} currency={false} /></span>
          ))}
          {fastingTest ? <span className="badge b-amber"><UtensilsCrossed className="size-3" aria-hidden />{t("pp.hd.fastingTest")}</span> : null}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="flex items-center gap-1.5"><Syringe className="size-4 text-primary" aria-hidden />{r.slot}</span>
          <span className="flex items-center gap-2">
            {r.visit?.eta ? <span className="badge b-sky">{t("pp.hd.eta")}: <span className="mono">{bhTimeString(r.visit.eta)}</span></span> : null}
            <MoneyText fils={r.feeFils} className="font-bold" />
          </span>
        </div>
      </div>
    </li>
  );
}

function RequestForm({ onDone }: { onDone: () => void }) {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const [sel, setSel] = useState<string[]>([]);
  const [gov, setGov] = useState("capital");
  const [slot, setSlot] = useState(SLOT_OPTS[0].value);
  const [fasting, setFasting] = useState(false);
  const [gender, setGender] = useState("any");
  const [area, setArea] = useState(""); const [block, setBlock] = useState("");
  const [building, setBuilding] = useState(""); const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const zone = HOME_ZONES.find((z) => z.code === gov) ?? HOME_ZONES[0];
  const evening = slot.includes("مساء");
  const estFils = zone.feeFils + (evening ? zone.eveningFils : 0);
  const testsTotal = HOME_TESTS.filter((x) => sel.includes(x.code)).reduce((a, x) => a + x.priceFils, 0);

  const toggle = (code: string, isFasting: boolean) => {
    setSel((s) => s.includes(code) ? s.filter((c) => c !== code) : [...s, code]);
    if (isFasting) setFasting(true); // smart default: fasting test ⇒ fasting patient
  };

  const submit = async () => {
    setBusy(true);
    try {
      const r = await apiPost<{ id: string; code: string; feeFils: number }>("/api/patient/home-request", {
        tests: HOME_TESTS.filter((x) => sel.includes(x.code)), slot, fasting, prefGender: gender,
        address: { governorate: gov, area, block, building, notes },
      });
      toast({ title: t("pp.hd.done", { code: r.code, fee: BHD3(r.feeFils) }) });
      setSel([]); setFasting(false);
      onDone();
    } catch (e) {
      toast({ title: t("common.error"), description: errText(e, lang), variant: "destructive" });
    } finally { setBusy(false); }
  };

  return (
    <SectionCard title={t("pp.hd.newRequest")} icon={MapPin}>
      <div className="grid gap-4">
        <div>
          <p className="mb-1.5 text-sm font-medium">{t("pp.hd.tests")}</p>
          <div className="flex flex-wrap gap-2">
            {HOME_TESTS.map((x) => {
              const on = sel.includes(x.code);
              return (
                <button key={x.code} type="button" aria-pressed={on} onClick={() => toggle(x.code, x.fasting)}
                  className={`chip min-h-11 ${on ? "active" : ""}`}>
                  {on ? <Check className="size-4" aria-hidden /> : null}
                  {bi(lang, x.nameAr, x.nameEn ?? x.nameAr)} · <MoneyText fils={x.priceFils} currency={false} />
                  {x.fasting ? <UtensilsCrossed className="size-3.5 opacity-80" aria-label={t("pp.hd.fastingTest")} /> : null}
                </button>
              );
            })}
          </div>
          {!sel.length ? <p className="mt-1.5 text-xs text-muted-foreground">{t("pp.hd.testsNote")}</p> : null}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="hd-gov">{t("pp.hd.gov")}</Label>
            <Select value={gov} onValueChange={setGov}>
              <SelectTrigger id="hd-gov" className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                {HOME_ZONES.map((z) => (
                  <SelectItem key={z.code} value={z.code} className="min-h-11">
                    <span className="flex items-center gap-2">{t(`pp.gov.${z.code}`)}<MoneyText fils={z.feeFils} currency={false} className="text-xs text-muted-foreground" /></span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="hd-slot">{t("pp.hd.slot")}</Label>
            <Select value={slot} onValueChange={setSlot}>
              <SelectTrigger id="hd-slot" className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SLOT_OPTS.map((o) => (
                  <SelectItem key={o.value} value={o.value} className="min-h-11">
                    <span className="flex items-center gap-2">{t(o.labelKey)}
                      {o.evening ? <span className="text-xs text-amber-700 dark:text-amber-300">+<MoneyText fils={zone.eveningFils} currency={false} /></span> : null}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5"><Label htmlFor="hd-area">{t("pp.hd.area")}</Label><Input id="hd-area" className="h-11" value={area} onChange={(e) => setArea(e.target.value)} /></div>
          <div className="grid gap-1.5"><Label htmlFor="hd-block">{t("pp.hd.block")}</Label><Input id="hd-block" className="h-11" value={block} onChange={(e) => setBlock(e.target.value)} /></div>
          <div className="grid gap-1.5"><Label htmlFor="hd-building">{t("pp.hd.building")}</Label><Input id="hd-building" className="h-11" value={building} onChange={(e) => setBuilding(e.target.value)} /></div>
          <div className="grid gap-1.5"><Label htmlFor="hd-notes">{t("pp.hd.notes")}</Label><Input id="hd-notes" className="h-11" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="hd-gender">{t("pp.hd.prefGender")}</Label>
            <Select value={gender} onValueChange={setGender}>
              <SelectTrigger id="hd-gender" className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["any", "female", "male"].map((g) => <SelectItem key={g} value={g} className="min-h-11">{t(`pp.hd.${g}`)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-xl border p-3">
            <div>
              <Label htmlFor="hd-fasting" className="text-sm">{t("pp.hd.fasting")}</Label>
              <p className="text-xs text-muted-foreground">{t("pp.hd.fastingNote")}</p>
            </div>
            <Switch id="hd-fasting" checked={fasting} onCheckedChange={setFasting} aria-label={t("pp.hd.fasting")} />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted/50 p-3 text-sm">
          <span className="text-muted-foreground">{t("pp.hd.testsTotal")}: <MoneyText fils={testsTotal} className="font-semibold text-foreground" /></span>
          <span className="text-muted-foreground">{t("pp.hd.estimateTotal")} ({t("pp.hd.estimate")}): <MoneyText fils={estFils} className="text-base font-bold text-primary" /></span>
        </div>
        <Button className="min-h-11" disabled={!sel.length || busy} onClick={submit}>
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}{t("pp.hd.submit")}
        </Button>
      </div>
    </SectionCard>
  );
}

export default function HomeDrawScreen() {
  const { t } = useI18n();
  const track = useFetch<HomeTrack[]>(() => apiGet<HomeTrack[]>("/api/patient/home-tracking"));
  return (
    <div className="grid gap-4">
      <PageHead icon={Syringe} title={t("pp.hd.title")} sub={t("pp.hd.subCard")} />
      <RequestForm onDone={track.reload} />
      {track.loading ? <LoadingRows n={2} h="h-40" /> : track.error ? <ErrorBox error={track.error} onRetry={track.reload} /> : (
        <SectionCard title={t("pp.hd.tracking")} icon={MapPin} contentClassName="p-0">
          {(track.data ?? []).length ? (
            <ul className="list-group gap-3 p-4" role="list">{(track.data ?? []).map((r) => <TrackCard key={r.code} r={r} />)}</ul>
          ) : <EmptyState icon={Syringe} text={t("pp.hd.empty")} />}
        </SectionCard>
      )}
    </div>
  );
}
