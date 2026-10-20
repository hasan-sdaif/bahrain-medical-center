"use client";
/**
 * Patient portal — shared presentational bits re-skinned with the Shamel
 * guide classes: SectionCard (`.card/.card-head/.card-body`), EmptyState
 * (`.empty-state`), ErrorBox (`.alert.alert-danger`), LoadingRows (`.skeleton`)
 * and the small Code128 barcode block.
 */
import type { ReactNode } from "react";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Code128 } from "@/components/shared/barcode";
import { AlertTriangle, Inbox, RotateCw, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function SectionCard({
  title, icon: Icon, action, children, className, contentClassName,
}: {
  title?: string; icon?: LucideIcon; action?: ReactNode; children: ReactNode; className?: string; contentClassName?: string;
}) {
  return (
    <section className={cn("card", className)}>
      {title ? (
        <div className="card-head">
          <div className="ch-title">
            {Icon ? (
              <span className="ch-ic" aria-hidden><Icon className="size-4" /></span>
            ) : null}
            <span>{title}</span>
          </div>
          {action ? <div className="ch-tools">{action}</div> : null}
        </div>
      ) : null}
      <div className={cn("card-body", contentClassName)}>{children}</div>
    </section>
  );
}

export function EmptyState({ icon: Icon = Inbox, text, className }: { icon?: LucideIcon; text: string; className?: string }) {
  return (
    <div className={cn("empty-state py-8", className)} role="status">
      <div className="es-ic mb-3 size-[72px]" aria-hidden><Icon className="size-8" /></div>
      <p className="text-sm">{text}</p>
    </div>
  );
}

export function ErrorBox({ error, onRetry, className }: { error: string; onRetry?: () => void; className?: string }) {
  const { t } = useI18n();
  return (
    <div role="alert" className={cn("alert alert-danger items-start", className)}>
      <AlertTriangle className="al-ic size-4.5 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="al-title">{t("common.error")}</p>
        <p className="text-sm opacity-90">{error}</p>
        {onRetry ? (
          <Button variant="outline" size="sm" onClick={onRetry} className="mt-2 min-h-11" aria-label={t("common.retry")}>
            <RotateCw className="size-4" aria-hidden />{t("common.retry")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function LoadingRows({ n = 3, h = "h-20" }: { n?: number; h?: string }) {
  return (
    <div className="grid gap-3" aria-busy="true" aria-label="loading">
      {Array.from({ length: n }, (_, i) => <div key={i} className={cn("skeleton w-full rounded-xl", h)} />)}
    </div>
  );
}

/** Small Code128 block with the check-in hint underneath. */
export function BarcodeBlock({ value, hint, compact = false }: { value: string; hint?: string; compact?: boolean }) {
  return (
    <div className="card items-center gap-1 p-3">
      <Code128 value={value} height={compact ? 34 : 48} className="max-w-full" />
      {hint ? <p className="text-center text-xs font-semibold text-primary">{hint}</p> : null}
    </div>
  );
}
