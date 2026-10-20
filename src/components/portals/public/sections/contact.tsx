"use client";
/**
 * Contact section — tracked message form (POST /api/public/contact → CMP- code
 * with reply SLA) + careers panel (jobs from catalog).
 */
import { useState } from "react";
import { Briefcase, CheckCircle2, Loader2, MailPlus, Send } from "lucide-react";
import { useI18n, bi } from "@/i18n";
import { apiPost } from "@/lib/api-client";
import { useApp } from "@/store/app";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Section, SectionHeader } from "../section-shell";
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
    <Section id="contact" className="bg-muted/40">
      <div className="mx-auto max-w-[1600px] px-4 md:px-6">
        <SectionHeader icon={MailPlus} title={t("public.contact.title")} subtitle={t("public.contact.subtitle")} />

        <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-2">
          <Card className="p-0">
            <CardContent className="p-5 md:p-6">
              {done ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 py-8 text-center">
                  <CheckCircle2 className="size-12 text-emerald-600" aria-hidden />
                  <p className="font-semibold">{t("public.contact.success.title")}</p>
                  <div className="rounded-xl border bg-muted/50 px-4 py-3 text-sm">
                    <span className="text-muted-foreground">{t("public.contact.tracking")}: </span>
                    <span className="font-mono font-bold">{done.tracking}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{t("public.contact.sla")}: {done.sla}</p>
                  <Button variant="outline" size="sm" className="mt-2 h-10" onClick={() => { setDone(null); setName(""); setPhone(""); setMessage(""); setCategory("general"); }}>
                    {t("public.contact.another")}
                  </Button>
                </div>
              ) : (
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="pub-contact-name">{t("public.contact.category")}</Label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger id="pub-contact-cat" className="h-11"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c}>{t(`public.contact.cat.${c}`)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
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
                  <Button className="h-11 justify-center gap-2" disabled={busy} onClick={send}>
                    {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}
                    {busy ? t("public.contact.sending") : t("public.contact.send")}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="p-0">
            <CardContent className="p-5 md:p-6">
              <div className="flex items-center gap-2">
                <Briefcase className="size-5 text-primary" aria-hidden />
                <h3 className="font-bold">{t("public.jobs.title")}</h3>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{t("public.jobs.subtitle")}</p>
              <div className="mt-4 grid gap-3">
                {data.jobs.length ? data.jobs.slice(0, 4).map((j, i) => (
                  <div key={i} className="rounded-xl border bg-background p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold leading-tight">{bi(lang, j.titleAr, j.titleEn)}</span>
                      <Badge variant="outline" className="shrink-0 font-normal">{t("public.jobs.openings", { n: j.openings })}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{t("public.jobs.dept")}: {j.dept}</p>
                  </div>
                )) : (
                  <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">{t("public.jobs.empty")}</p>
                )}
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                {t("public.jobs.apply")} <span className="font-mono" dir="ltr">careers@bmc.bh</span>
              </p>
              <Button variant="outline" size="sm" className="mt-3 h-10" onClick={() => setDomain("patient")}>
                {t("public.footer.links.patient")}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </Section>
  );
}
