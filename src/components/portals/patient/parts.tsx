"use client";
/**
 * Patient portal — shared presentational bits (section cards, empty/error
 * states, skeleton rows, small barcode block).
 */
import type { ReactNode } from "react";
import { useI18n } from "@/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Code128 } from "@/components/shared/barcode";
import { AlertTriangle, Inbox, RotateCw, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function SectionCard({
  title, icon: Icon, action, children, className, contentClassName,
}: {
  title?: string; icon?: LucideIcon; action?: ReactNode; children: ReactNode; className?: string; contentClassName?: string;
}) {
  return (
    <Card className={cn("gap-3 py-4", className)}>
      {title ? (
        <CardHeader className="px-4">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            {Icon ? <Icon className="size-4 text-primary" aria-hidden /> : null}
            <span>{title}</span>
            {action ? <span className="ms-auto">{action}</span> : null}
          </CardTitle>
        </CardHeader>
      ) : null}
      <CardContent className={cn("px-4", contentClassName)}>{children}</CardContent>
    </Card>
  );
}

export function EmptyState({ icon: Icon = Inbox, text, className }: { icon?: LucideIcon; text: string; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-10 text-center text-muted-foreground", className)} role="status">
      <Icon className="size-8 opacity-60" aria-hidden />
      <p className="text-sm">{text}</p>
    </div>
  );
}

export function ErrorBox({ error, onRetry, className }: { error: string; onRetry?: () => void; className?: string }) {
  const { t } = useI18n();
  return (
    <div role="alert" className={cn("flex flex-col items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive", className)}>
      <span className="flex items-center gap-2 font-medium"><AlertTriangle className="size-4" aria-hidden />{t("common.error")}</span>
      <span className="text-foreground/80">{error}</span>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry} className="min-h-11" aria-label={t("common.retry")}>
          <RotateCw className="size-4" aria-hidden />{t("common.retry")}
        </Button>
      ) : null}
    </div>
  );
}

export function LoadingRows({ n = 3, h = "h-20" }: { n?: number; h?: string }) {
  return (
    <div className="grid gap-3" aria-busy="true" aria-label="loading">
      {Array.from({ length: n }, (_, i) => <Skeleton key={i} className={cn("w-full rounded-xl", h)} />)}
    </div>
  );
}

/** Small Code128 block with the check-in hint underneath. */
export function BarcodeBlock({ value, hint, compact = false }: { value: string; hint?: string; compact?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl border bg-card p-3">
      <Code128 value={value} height={compact ? 34 : 48} className="max-w-full" />
      {hint ? <p className="text-center text-xs font-medium text-primary">{hint}</p> : null}
    </div>
  );
}
