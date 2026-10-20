"use client";
/**
 * SubNav — the anchor quick-jump strip (refined from the original sticky
 * sub-nav). Sticks below the site header on md+ (domain bar 44 + header 76 =
 * 120px offset); stays static on small screens to save vertical space.
 * Active section tracked with the same IntersectionObserver approach.
 */
import { useEffect, useState } from "react";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";

export const NAV = [
  { id: "departments", key: "public.nav.departments" },
  { id: "doctors", key: "public.nav.doctors" },
  { id: "services", key: "public.nav.services" },
  { id: "booking", key: "public.nav.booking" },
  { id: "homecare", key: "public.nav.homecare" },
  { id: "articles", key: "public.nav.articles" },
  { id: "faq", key: "public.nav.faq" },
  { id: "contact", key: "public.nav.contact" },
];

export function SubNav() {
  const { t } = useI18n();
  const [active, setActive] = useState("top");

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => { for (const e of entries) if (e.isIntersecting) setActive(e.target.id); },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    for (const n of NAV) {
      const el = document.getElementById(n.id);
      if (el) obs.observe(el);
    }
    return () => obs.disconnect();
  }, []);

  return (
    <nav
      aria-label={t("public.nav.jump")}
      className="no-print z-30 border-b border-line bg-surface/90 backdrop-blur supports-[backdrop-filter]:bg-surface/80 md:sticky md:top-[120px]"
    >
      <div className="container flex items-center gap-1.5 overflow-x-auto py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <span className="me-1 hidden shrink-0 text-[11px] font-bold uppercase tracking-wider text-ink-3 lg:inline">
          {t("public.nav.jump")}
        </span>
        {NAV.map((n) => (
          <a
            key={n.id}
            href={`#${n.id}`}
            aria-current={active === n.id ? "true" : undefined}
            className={cn(
              "flex h-8 shrink-0 items-center rounded-full px-3.5 text-xs font-bold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
              active === n.id
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-ink-2 hover:bg-surface-3 hover:text-primary",
            )}
          >
            {t(n.key)}
          </a>
        ))}
      </div>
    </nav>
  );
}
