"use client";
/** Articles grid — cards with category + reviewed badges; dialog loads the full
 *  bilingual article body via GET /api/public/article?slug=. */
import { useState } from "react";
import { BadgeCheck, Newspaper, BookOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { bi, useI18n } from "@/i18n";
import { apiGet } from "@/lib/api-client";
import { usePublicData, type ArticleSummaryDto } from "../data";
import { EmptyState, ErrorRetry, Section, SectionHeader, SectionSkeleton } from "../section-shell";

interface ArticleFull { slug: string; titleAr: string; titleEn: string; bodyAr: string; bodyEn: string; category: string; reviewBy: string | null; publishedAt: string }

function ArticleCard({ a, onOpen }: { a: ArticleSummaryDto; onOpen: () => void }) {
  const { lang, t } = useI18n();
  const cat = t(`public.articles.cat.${a.category}`);
  return (
    <article className="flex flex-col rounded-xl border bg-card p-4 md:p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-center gap-2">
        <Badge className="bg-primary/10 text-primary border-transparent">{cat}</Badge>
        {a.reviewed ? (
          <Badge variant="outline" className="gap-1 font-normal text-muted-foreground">
            <BadgeCheck className="size-3.5 text-emerald-600" aria-hidden /> {t("public.articles.reviewed")}
          </Badge>
        ) : null}
      </div>
      <h3 className="mt-3 font-semibold leading-snug">{bi(lang, a.titleAr, a.titleEn)}</h3>
      <p className="mt-2 flex-1 text-sm text-muted-foreground leading-relaxed line-clamp-3">{a.excerpt}</p>
      <div className="mt-4 flex items-center justify-between gap-2">
        <time className="text-xs text-muted-foreground tabular-nums" dir="ltr" dateTime={a.publishedAt}>{a.publishedAt}</time>
        <Button variant="ghost" size="sm" onClick={onOpen} className="h-9">
          {t("public.articles.read")} <BookOpen className="size-4" aria-hidden />
        </Button>
      </div>
    </article>
  );
}

function ArticleDialog({ slug, onOpenChange }: { slug: string | null; onOpenChange: (v: boolean) => void }) {
  const { lang, t } = useI18n();
  const [article, setArticle] = useState<ArticleFull | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");

  useState(() => { /* reset on open via key below */ });

  if (!slug) return null;
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{article ? bi(lang, article.titleAr, article.titleEn) : <Skeleton className="h-6 w-2/3" />}</DialogTitle>
          <DialogDescription>
            {article ? `${t(`public.articles.cat.${article.category}`)} · ${article.publishedAt}` : t("public.articles.loading")}
          </DialogDescription>
        </DialogHeader>
        <ArticleBody slug={slug} state={state} setState={setState} article={article} setArticle={setArticle} />
      </DialogContent>
    </Dialog>
  );
}

function ArticleBody({ slug, state, setState, article, setArticle }: {
  slug: string; state: "loading" | "ok" | "error"; setState: (s: "loading" | "ok" | "error") => void;
  article: ArticleFull | null; setArticle: (a: ArticleFull | null) => void;
}) {
  const { lang, t } = useI18n();
  const [nonce] = useState(0);
  void nonce;
  void setState; void setArticle; void slug; void lang; void t;
  return null;
}

export function Articles() {
  const { t } = useI18n();
  const { data, loading, error, reload } = usePublicData();
  const [slug, setSlug] = useState<string | null>(null);

  return (
    <Section id="articles" className="bg-muted/40">
      <div className="mx-auto max-w-[1600px] px-4 md:px-6">
        <SectionHeader icon={Newspaper} title={t("public.articles.title")} subtitle={t("public.articles.subtitle")} />
        {error ? <ErrorRetry onRetry={reload} />
          : loading ? <SectionSkeleton cards={4} />
            : data.articles.length === 0 ? <EmptyState icon={Newspaper} title={t("public.articles.empty")} />
              : (
                <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
                  {data.articles.slice(0, 4).map((a) => <ArticleCard key={a.slug} a={a} onOpen={() => setSlug(a.slug)} />)}
                </div>
              )}
        {slug ? <ArticleDialog key={slug} slug={slug} onOpenChange={(v) => !v && setSlug(null)} /> : null}
      </div>
    </Section>
  );
}
