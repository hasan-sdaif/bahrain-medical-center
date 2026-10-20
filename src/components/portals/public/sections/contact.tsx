"use client";
/**
 * Contact section — tracked message form (POST /api/public/contact → CMP- code
 *  with reply SLA) + careers panel (jobs from catalog). Restyled to the Shamel
 *  card pattern (card-head with ch-ic tile, card-body, list-group rows).
 */
import { useState } from "react";
import { Briefcase, CheckCircle2, Loader2, MailPlus, Send } from "lucide-react";
import { useI18n, bi } from "@/i18n";
import { apiPost } from "@/lib/api-client";
import { useApp } from "@/store/app";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Container, Section, SectionHeader } from "../section-shell";
import { usePublicData, problemDetail } from "../data";

const CATEGORIES = ["general", "waiting", "billing", "service", "quality"] as const;

export function Contact() {
  const { t, lang } = useI18n();
  const { data } = usePublicData();
  const setDomain = useApp((s) => s.setDomain);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [category, setCategory] = useState<string>("general");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<{ tracking: string; sla: string } | null>(null);

  const send = async () => {
    setErr(null);
    if (!name.trim() || !message.trim()) { setErr(t("public.contact.err")); return; }
    setBusy(true);
    try {
      const r = await apiPost<{ tracking: string; slaAr: string; slaEn: string }>("/api/public/contact", {
        nameAr: name.trim(), phone: phone.trim() || undefined, message: message.trim(), category,
      });
      setDone({ tracking: r.tracking, sla: lang === "ar" ? r.slaAr : r.slaEn });
    } catch (e) {
      setErr(problemDetail(e, lang) ?? t("public.contact.err"));
    }
    setBusy(false);
  };

  return (
    <Section id="contact" className="alt">
      <Container>
        <SectionHeader
          icon={MailPlus}
          eyebrow={t("public.contact.eyebrow")}
          title={t("public.contact.title")}
          subtitle={t("public.contact.subtitle")}
        />

        <div className="grid gap-5 lg:grid-cols-2">
          <div className="card">
            <div className="card-head">
              <span className="ch-title">
                <span className="ch-ic"><MailPlus className="size-4" aria-hidden /></span>
                {t("public.contact.title")}
              </span>
            </div>
            <div className="card-body">
              {done ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 py-8 text-center">
                  <CheckCircle2 className="size-12 text-primary" aria-hidden />
                  <p className="font-bold">{t("public.contact.success.title")}</p>
                  <div className="rounded-xl border border-line bg-surface-2 px-4 py-3 text-sm">
                    <span className="text-ink-3">{t("public.contact.tracking")}: </span>
                    <span className="font-mono font-bold">{done.tracking}</span>
                  </div>
                  <p className="text-xs text-ink-3">{t("public.contact.sla")}: {done.sla}</p>
                  <button
                    className="btn btn-outline btn-sm h-10"
                    onClick={() => { setDone(null); setName(""); setPhone(""); setMessage(""); setCategory("general"); }}
                  >
                    {t("public.contact.another")}
                  </button>
                </div>
              ) : (
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="pub-contact-cat">{t("public.contact.category")}</Label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger id="pub-contact-cat" className="h-11"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c}>{t(`public.contact.cat.${c}`)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="pub-contact-name">{t("public.contact.name")} *</Label>
                      <Input id="pub-contact-name" className="h-11" value={name} onChange={(e) => setName(e.target.value)} />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="pub-contact-phone">{t("public.contact.phone")}</Label>
                      <Input id="pub-contact-phone" dir="ltr" inputMode="tel" className="h-11" value={phone} onChange={(e) => setPhone(e.target.value)} />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="pub-contact-msg">{t("public.contact.message")} *</Label>
                    <Textarea id="pub-contact-msg" rows={4} className="min-h-24" placeholder={t("public.contact.message.ph")} value={message} onChange={(e) => setMessage(e.target.value)} />
                  </div>
                  {err && <p className="text-sm text-destructive" role="alert">{err}</p>}
                  <button className="btn btn-primary btn-lg btn-block" disabled={busy} onClick={send}>
                    {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}
                    {busy ? t("public.contact.sending") : t("public.contact.send")}
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <span className="ch-title">
                <span className="ch-ic"><Briefcase className="size-4" aria-hidden /></span>
                {t("public.jobs.title")}
              </span>
              <span className="ch-sub">{t("public.jobs.subtitle")}</span>
            </div>
            <div className="card-body p-0">
              <div className="list-group">
                {data.jobs.length ? data.jobs.slice(0, 4).map((j, i) => (
                  <div key={i} className="list-item">
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                      <Briefcase className="size-4" aria-hidden />
                    </span>
                    <span className="li-body">
                      <span className="li-title">{bi(lang, j.titleAr, j.titleEn)}</span>
                      <span className="li-sub">{t("public.jobs.dept")}: {j.dept}</span>
                    </span>
                    <span className="badge b-teal shrink-0">{t("public.jobs.openings", { n: j.openings })}</span>
                  </div>
                )) : (
                  <p className="p-5 text-sm text-ink-3">{t("public.jobs.empty")}</p>
                )}
              </div>
              <div className="card-body">
                <p className="text-xs text-ink-3">
                  {t("public.jobs.apply")} <span className="mono font-semibold">careers@bmc.bh</span>
                </p>
                <button className="btn btn-outline mt-3 h-11 w-full sm:w-auto" onClick={() => setDomain("patient")}>
                  {t("public.footer.links.patient")}
                </button>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </Section>
  );
}
