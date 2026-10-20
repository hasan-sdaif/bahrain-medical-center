"use client";
/** Articles grid — Shamel `.article-card` pattern (gradient ac-img tile with
 *  category icon, badge, title, excerpt, meta row). The dialog now actually
 *  loads the full bilingual body via GET /api/public/article?slug= (the old
 *  body loader was a stub that rendered nothing). */
import { useEffect, useState } from "react";
import { BadgeCheck, BookOpen, HeartPulse, Newspaper, RotateCcw, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { bi, useI18n } from "@/i18n";
import { apiGet } from "@/lib/api-client";
import { usePublicData, type ArticleSummaryDto } from "../data";
import { Container, EmptyState, ErrorRetry, Section, SectionHeader, SectionSkeleton } from "../section-shell";

interface ArticleFull {
  slug: string; titleAr: string; titleEn: string; bodyAr: string; bodyEn: string;
  category: string; reviewBy: string | null; publishedAt: string;
}

const CAT_STYLE: Record<string, { grad: string; badge: string; Icon: typeof Newspaper }> = {
  education: { grad: "var(--grad-teal)", badge: "b-teal", Icon: BookOpen },
  awareness: { grad: "var(--grad-gold)", badge: "b-gold", Icon: HeartPulse },
  service: { grad: "var(--grad-navy)", badge: "b-navy", Icon: Stethoscope },
};

const SK_WIDTHS = ["w-[92%]", "w-full", "w-[96%]", "w-[84%]", "w-[62%]"];

function ArticleCard({ a, onOpen }: { a: ArticleSummaryDto; onOpen: () => void }) {
  const { lang, t } = useI18n();
  const cat = t(`public.articles.cat.${a.category}`);
  const style = CAT_STYLE[a.category] ?? { grad: "var(--grad-teal)", badge: "b-teal", Icon: Newspaper };
  return (
    <article className="card article-card interactive">
      <div className="ac-img" style={{ background: style.grad }}>
        <style.Icon className="size-11 text-white/90" aria-hidden />
      </div>
      <div className="ac-body">
        <div className="ac-cat flex flex-wrap items-center gap-1.5">
          <span className={`badge ${style.badge}`}>{cat}</span>
          {a.reviewed ? (
            <span className="badge b-green gap-1">
              <BadgeCheck className="size-3" aria-hidden /> {t("public.articles.reviewed")}
            </span>
          ) : null}
        </div>
        <h4 className="leading-relaxed">{bi(lang, a.titleAr, a.titleEn)}</h4>
        <p className="ac-excerpt clamp-3">{a.excerpt}</p>
        <div className="ac-meta">
          <time className="num" dateTime={a.publishedAt}>{a.publishedAt}</time>
          <Button variant="ghost" size="sm" onClick={onOpen} className="ms-auto h-8 gap-1.5 text-primary hover:text-primary">
            {t("public.articles.read")} <BookOpen className="size-4" aria-hidden />
          </Button>
        </div>
      </div>
    </article>
  );
}

function ArticleDialog({ slug, onOpenChange }: { slug: string | null; onOpenChange: (v: boolean) => void }) {
  const { lang, t } = useI18n();
  const [article, setArticle] = useState<ArticleFull | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!slug) return;
    const ctl = new AbortController();
    setState("loading");
    setArticle(null);
    apiGet<ArticleFull>(`/api/public/article?slug=${encodeURIComponent(slug)}`, ctl.signal)
      .then((a) => { setArticle(a); setState("ok"); })
      .catch((e: unknown) => { if ((e as Error).name !== "AbortError") setState("error"); });
    return () => ctl.abort();
  }, [slug, nonce]);

  return (
    <Dialog open={!!slug} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{article ? bi(lang, article.titleAr, article.titleEn) : <Skeleton className="h-6 w-2/3" />}</DialogTitle>
          <DialogDescription>
            {article
              ? `${t(`public.articles.cat.${article.category}`)} · ${article.publishedAt}${article.reviewBy ? ` · ${t("public.articles.reviewed")}: ${article.reviewBy}` : ""}`
              : t("public.articles.loading")}
          </DialogDescription>
        </DialogHeader>
        {state === "loading" ? (
          <div className="space-y-2.5">
            {SK_WIDTHS.map((w, i) => <Skeleton key={i} className={`h-4 ${w}`} />)}
          </div>
        ) : state === "error" ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <p className="text-sm text-ink-3">{t("public.load.error")}</p>
            <Button variant="outline" size="sm" className="h-9" onClick={() => setNonce((n) => n + 1)}>
              <RotateCcw className="size-4" aria-hidden /> {t("common.retry")}
            </Button>
          </div>
        ) : article ? (
          <div className="whitespace-pre-line text-sm leading-8 text-ink-2">
            {bi(lang, article.bodyAr, article.bodyEn)}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export function Articles() {
  const { t } = useI18n();
  const { data, loading, error, reload } = usePublicData();
  const [slug, setSlug] = useState<string | null>(null);

  return (
    <Section id="articles" className="alt">
      <Container>
        <SectionHeader
          icon={Newspaper}
          eyebrow={t("public.articles.eyebrow")}
          title={t("public.articles.title")}
          subtitle={t("public.articles.subtitle")}
        />
        {error ? <ErrorRetry onRetry={reload} />
          : loading ? <SectionSkeleton cards={4} />
            : data.articles.length === 0 ? <EmptyState icon={Newspaper} title={t("public.articles.empty")} />
              : (
                <div className="grid auto-320">
                  {data.articles.slice(0, 4).map((a) => <ArticleCard key={a.slug} a={a} onOpen={() => setSlug(a.slug)} />)}
                </div>
              )}
        {slug ? <ArticleDialog slug={slug} onOpenChange={(v) => !v && setSlug(null)} /> : null}
      </Container>
    </Section>
  );
}
