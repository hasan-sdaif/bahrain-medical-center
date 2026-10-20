"use client";
/**
 * Shared building blocks for the public site sections — consistent spacing,
 * headers, loading/error/empty states, and RTL-aware arrows.
 */
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { ArrowLeft, ArrowRight, RotateCcw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n";

export function Section({ id, children, className }: { id: string; children: React.ReactNode; className?: string }) {
  return (
    <section id={id} className={cn("scroll-mt-28 py-10 md:py-14", className)}>
      {children}
    </section>
  );
}

export function SectionHeader({ icon: Icon, title, subtitle, light }: { icon: LucideIcon; title: string; subtitle?: string; light?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="mx-auto mb-8 md:mb-10 max-w-3xl text-center"
    >
      <span className={cn("mx-auto mb-3 grid size-11 place-items-center rounded-xl", light ? "bg-white/15 text-white" : "bg-primary/10 text-primary")}>
        <Icon className="size-5" aria-hidden />
      </span>
      <h2 className={cn("text-2xl md:text-3xl font-bold tracking-tight", light && "text-white")}>{title}</h2>
      {subtitle ? <p className={cn("mt-2 text-sm md:text-base text-muted-foreground", light && "text-white/80")}>{subtitle}</p> : null}
    </motion.div>
  );
}

/** next/back arrow that flips automatically in RTL */
export function DirArrow({ back }: { back?: boolean }) {
  const { dir } = useI18n();
  const forwardIsRight = dir === "ltr";
  const Icon = (back ? !forwardIsRight : forwardIsRight) ? ArrowRight : ArrowLeft;
  return <Icon className="size-4" aria-hidden />;
}

export function ErrorRetry({ onRetry, message }: { onRetry: () => void; message?: string }) {
  const { t } = useI18n();
  return (
    <Alert variant="destructive" className="mx-auto max-w-xl">
      <AlertDescription className="flex flex-wrap items-center gap-3">
        <span className="flex-1 min-w-40">{message ?? t("public.load.error")}</span>
        <Button variant="outline" size="sm" onClick={onRetry} className="h-9">
          <RotateCcw className="size-4" aria-hidden /> {t("common.retry")}
        </Button>
      </AlertDescription>
    </Alert>
  );
}

export function SectionSkeleton({ cards = 8, className }: { cards?: number; className?: string }) {
  return (
    <div className={cn("grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4", className)}>
      {Array.from({ length: cards }).map((_, i) => (
        <Skeleton key={i} className="h-36 rounded-xl" />
      ))}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, desc }: { icon: LucideIcon; title: string; desc?: string }) {
  return (
    <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
      <Icon className="mx-auto mb-2 size-8 opacity-60" aria-hidden />
      <p className="font-medium">{title}</p>
      {desc ? <p className="mt-1 text-sm">{desc}</p> : null}
    </div>
  );
}
