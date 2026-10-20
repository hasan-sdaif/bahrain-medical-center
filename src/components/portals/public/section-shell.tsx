"use client";
/**
 * Shared building blocks for the public site sections — restyled to the Shamel
 * guide patterns (agent 2-a): `.section` / `.container` rhythm, `.section-head`
 * with `.eyebrow` + `.section-title` + `.section-desc`, Shamel empty state,
 * loading skeletons and RTL-aware arrows. All existing exports keep their
 * signatures so section files compile unchanged where not restyled.
 */
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { ArrowLeft, ArrowRight, RotateCcw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n";

/** Section wrapper — Shamel `.section` vertical rhythm + anchor scroll offset
 *  (chrome when scrolled: domain bar 44 + header 76 [+ subnav 44 on md+],
 *  compounded with the html scroll-padding of 90px). */
export function Section({ id, children, className }: { id: string; children: React.ReactNode; className?: string }) {
  return (
    <section id={id} className={cn("section scroll-mt-10 md:scroll-mt-20", className)}>
      {children}
    </section>
  );
}

/** Shamel `.container` (max-width 1200, inline padding 24). */
export function Container({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("container", className)}>{children}</div>;
}

/** Guide section head: gold-dash eyebrow (with optional icon) + title + desc. */
export function SectionHeader({
  icon: Icon, eyebrow, title, subtitle, light,
}: {
  icon?: LucideIcon; eyebrow?: string; title: string; subtitle?: string; light?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="section-head"
    >
      {eyebrow ? (
        <span className={cn("eyebrow", light && "text-white/90")}>
          {Icon ? <Icon className="size-4" aria-hidden /> : null}
          {eyebrow}
        </span>
      ) : null}
      <h2 className={cn("section-title", light && "text-white")}>{title}</h2>
      {subtitle ? (
        <p className={cn("section-desc", light && "text-white/75")}>{subtitle}</p>
      ) : null}
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

/** Shamel `.empty-state` pattern (88px icon tile + title + hint). */
export function EmptyState({ icon: Icon, title, desc }: { icon: LucideIcon; title: string; desc?: string }) {
  return (
    <div className="empty-state">
      <div className="es-ic">
        <Icon className="size-9" aria-hidden />
      </div>
      <h4 className="text-base font-bold">{title}</h4>
      {desc ? <p>{desc}</p> : null}
    </div>
  );
}
