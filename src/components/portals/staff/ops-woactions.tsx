"use client";
/** Work-order status transitions (start / await part / done) + close flow w/ MTTR. */
import { useState, type FormEvent } from "react";
import { useI18n } from "@/i18n";
import { useApp } from "@/store/app";
import { apiPost } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, Loader2, PauseCircle, PlayCircle, XCircle } from "lucide-react";
import { MAINT_ROLES, errText, type WoRow } from "./ops-shared";

const ACTIVE = new Set(["open", "assigned", "in-progress", "awaiting-part", "done"]);

export function WoActions({ wo, onReload }: { wo: WoRow; onReload: () => void }) {
  const { t, lang } = useI18n();
  const { staff } = useApp();
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [noteMode, setNoteMode] = useState(false);
  const [note, setNote] = useState("");
  const [closeMode, setCloseMode] = useState(false);
  const [root, setRoot] = useState("");
  const [action, setAction] = useState("");
  const [down, setDown] = useState<string>(String(wo.downtimeMin ?? 0));
  const [sign, setSign] = useState("");
  const [result, setResult] = useState<{ mttrMin: number } | null>(null);

  const canWork = !!staff && MAINT_ROLES.has(staff.role) && ACTIVE.has(wo.status) && !result;

  const post = async (label: string, path: string, body: Record<string, unknown>, okToast?: string) => {
    if (busy) return;
    setBusy(label);
    try {
      const res = await apiPost<{ mttrMin?: number }>(`/api/staff/maintenance/${path}`, { workOrderId: wo.id, ...body });
      onReload();
      if (okToast) toast({ title: okToast });
      return res;
    } catch (ex) {
      toast({ title: t("common.error"), description: errText(ex, lang, ""), variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const close = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || !root.trim() || !action.trim()) return;
    const res = await post("close", "wo-close", {
      rootCauseAr: root.trim(), actionAr: action.trim(),
      downtimeMin: Number(down) || 0, signatureBy: sign.trim() || undefined,
    }, t("ops.wo.close.ok", { n: Number(down) || 0 }));
    if (res) setResult({ mttrMin: res.mttrMin ?? (Number(down) || 0) });
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">{t("ops.wo.actions")}</h3>
      {result ? (
        <Alert className="border-emerald-600/40 bg-emerald-50 dark:bg-emerald-950/40">
          <AlertDescription className="space-y-0.5 text-sm">
            <div className="font-semibold">{t("ops.wo.close.ok", { n: result.mttrMin })}</div>
            <div className="text-xs">{t("ops.wo.close.back")}</div>
          </AlertDescription>
        </Alert>
      ) : null}

      {canWork ? (
        <div className="flex flex-wrap gap-2">
          {wo.status !== "in-progress" ? (
            <Button variant="outline" className="h-11" disabled={!!busy}
              onClick={() => void post("start", "wo-status", { status: "in-progress" }, t("ops.wo.updated"))}>
              {busy === "start" ? <Loader2 className="size-4 animate-spin" /> : <PlayCircle className="size-4" />}
              {t("ops.wo.start")}
            </Button>
          ) : null}
          <Button variant="outline" className="h-11" disabled={!!busy} onClick={() => { setNoteMode((v) => !v); setCloseMode(false); }}>
            <PauseCircle className="size-4" />{t("ops.wo.await")}
          </Button>
          {wo.status !== "done" ? (
            <Button variant="outline" className="h-11" disabled={!!busy}
              onClick={() => void post("done", "wo-status", { status: "done" }, t("ops.wo.updated"))}>
              <CheckCircle2 className="size-4" />{t("ops.wo.finish")}
            </Button>
          ) : null}
          <Button variant="destructive" className="h-11" disabled={!!busy} onClick={() => { setCloseMode((v) => !v); setNoteMode(false); }}>
            <XCircle className="size-4" />{t("ops.wo.close")}
          </Button>
        </div>
      ) : null}

      {noteMode && canWork ? (
        <form
          className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-amber-500/60 bg-amber-50/50 p-3 dark:bg-amber-950/20"
          onSubmit={(e) => { e.preventDefault(); if (!note.trim()) return; void post("await", "wo-status", { status: "awaiting-part", note: note.trim() }, t("ops.wo.updated")).then(() => { setNote(""); setNoteMode(false); }); }}
        >
          <div className="min-w-56 flex-1 space-y-1">
            <Label htmlFor="wo-note">{t("ops.wo.await.note")}</Label>
            <Input id="wo-note" value={note} onChange={(e) => setNote(e.target.value)} className="h-10 text-sm" />
          </div>
          <Button type="submit" size="sm" className="h-10" disabled={!!busy || !note.trim()}>{t("common.confirm")}</Button>
        </form>
      ) : null}

      {closeMode && canWork ? (
        <form className="space-y-3 rounded-lg border p-3" onSubmit={close}>
          <div className="space-y-1.5">
            <Label htmlFor="wo-root">{t("ops.wo.close.root")}</Label>
            <Textarea id="wo-root" value={root} onChange={(e) => setRoot(e.target.value)} required className="min-h-16 text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wo-action">{t("ops.wo.close.action")}</Label>
            <Textarea id="wo-action" value={action} onChange={(e) => setAction(e.target.value)} required className="min-h-16 text-sm" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="wo-down">{t("ops.wo.close.downtime")}</Label>
              <Input id="wo-down" type="number" min={0} value={down} onChange={(e) => setDown(e.target.value)} className="h-10 font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wo-sign">{t("ops.wo.close.sign")}</Label>
              <Input id="wo-sign" value={sign} onChange={(e) => setSign(e.target.value)} placeholder={t("ops.wo.close.sign.ph")} className="h-10 text-sm" />
            </div>
          </div>
          <Button type="submit" className="h-11 w-full" disabled={!!busy || !root.trim() || !action.trim()}>
            {busy === "close" ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
            {t("ops.wo.close")}
          </Button>
        </form>
      ) : null}

      {wo.status === "closed" && !result ? (
        <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
          {wo.rootCauseAr ? <div>{t("ops.wo.close.root")}: {wo.rootCauseAr}</div> : null}
          {wo.actionAr ? <div>{t("ops.wo.close.action")}: {wo.actionAr}</div> : null}
          <div className="font-mono">{t("ops.assets.downtime")}: {wo.downtimeMin ?? 0} {t("ops.min.short")} — {t("ops.wo.close.back")}</div>
        </div>
      ) : null}
    </div>
  );
}
