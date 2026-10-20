"use client";
/**
 * Shamel site footer (guide `site-footer`): navy-950, footer-grid with brand
 * block + quick links + live department links + footer-contact details, and
 * the footer-bottom bar (copyright, NHRA note, social icons).
 */
import { Clock, Instagram, Mail, MapPin, MessageCircle, Phone, Twitter, Youtube } from "lucide-react";
import { bi, useI18n } from "@/i18n";
import { useApp } from "@/store/app";
import { ShamelMark } from "@/components/shell/brand";
import { usePublicData } from "../data";

const QUICK: { href: string; key: string }[] = [
  { href: "#departments", key: "public.nav.departments" },
  { href: "#doctors", key: "public.nav.doctors" },
  { href: "#booking", key: "public.nav.booking" },
  { href: "#services", key: "public.nav.services" },
  { href: "#homecare", key: "public.nav.homecare" },
  { href: "#faq", key: "public.nav.faq" },
  { href: "#contact", key: "public.nav.contact" },
];

const SYSTEM: { domain: "patient" | "verify" | "kiosk"; key: string }[] = [
  { domain: "patient", key: "public.footer.links.patient" },
  { domain: "verify", key: "public.footer.links.verify" },
  { domain: "kiosk", key: "public.footer.links.kiosk" },
];

const SOCIAL: { key: string; Icon: typeof Twitter }[] = [
  { key: "public.footer.social.x", Icon: Twitter },
  { key: "public.footer.social.instagram", Icon: Instagram },
  { key: "public.footer.social.youtube", Icon: Youtube },
  { key: "public.footer.social.whatsapp", Icon: MessageCircle },
];

export function SiteFooter() {
  const { t, lang } = useI18n();
  const setDomain = useApp((s) => s.setDomain);
  const { data } = usePublicData();
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer no-print">
      <div className="site-footer-inner">
        <div className="footer-grid">
          <div className="footer-brand">
            <ShamelMark size={52} />
            <h5 className="!mb-2.5 text-lg">{t("shell.app.name")}</h5>
            <p>{t("public.footer.tagline")}</p>
          </div>

          <div>
            <h5>{t("public.footer.links")}</h5>
            <ul className="footer-links">
              {QUICK.map((a) => (
                <li key={a.href}><a href={a.href}>{t(a.key)}</a></li>
              ))}
            </ul>
          </div>

          <div>
            <h5>{t("public.footer.depts")}</h5>
            <ul className="footer-links">
              {data.departments.slice(0, 6).map((d) => (
                <li key={d.code}><a href="#departments">{bi(lang, d.nameAr, d.nameEn)}</a></li>
              ))}
              {SYSTEM.map((s) => (
                <li key={s.domain}>
                  <a href="#top" onClick={(e) => { e.preventDefault(); setDomain(s.domain); }}>{t(s.key)}</a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h5>{t("public.footer.contact")}</h5>
            <ul className="footer-contact list-none p-0">
              <li>
                <span className="fc-ic"><MapPin className="size-4" aria-hidden /></span>
                {t("public.footer.address")}
              </li>
              <li>
                <span className="fc-ic"><Phone className="size-4" aria-hidden /></span>
                <a href="tel:+97317500000" dir="ltr" className="num">+973 1750 0000</a>
              </li>
              <li>
                <span className="fc-ic"><Mail className="size-4" aria-hidden /></span>
                <span dir="ltr" className="num">info@bmc.bh</span>
              </li>
              <li>
                <span className="fc-ic"><Clock className="size-4" aria-hidden /></span>
                {t("public.top.hours")}
              </li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <span>© {year} {t("shell.app.name")} — {t("shell.footer.rights")}</span>
          <span>{t("shell.footer.license")}</span>
          <div className="footer-social">
            {SOCIAL.map(({ key, Icon }) => (
              <a key={key} href="#top" onClick={(e) => e.preventDefault()} aria-label={t(key)}>
                <Icon className="size-4" aria-hidden />
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
