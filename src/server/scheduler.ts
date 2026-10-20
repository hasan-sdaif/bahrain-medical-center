/**
 * Background scheduler — started from src/instrumentation.ts on server boot.
 * Runs every 60s: critical alert escalation (10/20 min), appointment reminders,
 * preventive WO generation, license expiry warnings, low stock alerts.
 */
import { db } from "@/lib/db";
import { ja } from "@/lib/api";

let started = false;

async function notify(userId: string | null, role: string, kind: string, titleAr: string, titleEn: string, bodyAr?: string, bodyEn?: string): Promise<void> {
  await db.notification.create({ data: { userId, role, kind, titleAr, titleEn, bodyAr, bodyEn, channel: "inapp", status: "sent" } });
}

async function emitRealtime(event: string, payload: unknown): Promise<void> {
  try {
    await fetch("http://localhost:3003/emit", {
      method: "POST",
      headers: { "content-type": "application/json", "x-bmc-internal": process.env.BMC_INTERNAL_KEY ?? "bmc-dev-internal" },
      body: JSON.stringify({ event, room: "staff", payload }),
    });
  } catch { /* realtime optional */ }
}

export async function runSchedulerTick(): Promise<{ escalations: number; reminders: number; pm: number; warnings: number }> {
  const result = { escalations: 0, reminders: 0, pm: 0, warnings: 0 };
  const now = Date.now();

  // 1) Critical alert escalation chain (§17.6): 10min → onCall doctor; 20min → head+med director
  const alerts = await db.criticalAlert.findMany({ where: { status: { in: ["new", "escalated-1"] } },  });
  for (const a of alerts) {
    const ageMin = (now - a.notifiedAt.getTime()) / 60000;
    if (a.status === "new" && ageMin >= 10) {
      const onCall = await db.employee.findFirst({ where: { isDoctor: true, active: true } });
      await db.criticalAlert.update({ where: { id: a.id }, data: { status: "escalated-1", log: [...ja(a.log), { at: new Date().toISOString(), ev: "escalated-1", to: onCall?.nameAr ?? "on-call" }] as object[] } });
      await notify(null, "doctor", "critical-escalation", "تصعيد قيمة حرجة (10 دقائق)", "Critical value escalation (10 min)", `بوتاسيوم/قيمة حرجة — لم يؤكد الطبيب`, `Unacknowledged critical value`);
      await emitRealtime("notif:new", { kind: "critical-escalation" });
      result.escalations++;
    } else if (a.status === "escalated-1" && ageMin >= 20) {
      await db.criticalAlert.update({ where: { id: a.id }, data: { status: "escalated-2", log: [...ja(a.log), { at: new Date().toISOString(), ev: "escalated-2", to: "dept-head+med-director" }] as object[] } });
      await notify(null, "dept-head", "critical-escalation", "تصعيد نهائي لقيمة حرجة (20 دقيقة)", "Final escalation (20 min)");
      result.escalations++;
    }
  }

  // 2) Appointment reminders (24h & 2h) — no clinical content in the message
  const upcoming = await db.appointment.findMany({ where: { status: { in: ["requested", "confirmed"] }, start: { gte: new Date(now), lt: new Date(now + 26 * 3600000) } },  });
  for (const a of upcoming) {
    const hoursTo = (a.start.getTime() - now) / 3600000;
    if (hoursTo <= 24 && hoursTo > 23.5) {
      await db.notification.create({ data: { patientId: a.patientId, kind: "appt-reminder", titleAr: "تذكير: موعدك غداً", titleEn: "Reminder: appointment tomorrow", bodyAr: `موعدك غداً ${a.start.toISOString().slice(11, 16)} (توقيت البحرين) — أحضر بطاقتك وباركود الموعد`, bodyEn: `Tomorrow ${a.start.toISOString().slice(11, 16)} — bring your card & appointment barcode`, channel: "sms", status: "sent" } as never });
      result.reminders++;
    } else if (hoursTo <= 2 && hoursTo > 1.9) {
      await db.notification.create({ data: { patientId: a.patientId, kind: "appt-reminder", titleAr: "معدك بعد ساعتين", titleEn: "Appointment in 2 hours", bodyAr: "يمكنك تسجيل الحضور بالكشك بمسح الباركود من هاتفك", bodyEn: "Check in at the kiosk by scanning your phone barcode", channel: "sms", status: "sent" } as never });
      result.reminders++;
    }
  }

  // 3) Preventive maintenance WOs due within 3 days
  const assets = await db.asset.findMany({ where: { status: { in: ["operational", "down", "awaiting-calibration"] } } });
  for (const asset of assets) {
    if (asset.calibrationDueAt && asset.calibrationDueAt.getTime() - now < 3 * 86400000) {
      const exists = await db.workOrder.count({ where: { assetId: asset.id, kind: "calibration", status: { in: ["open", "assigned", "in-progress"] } } });
      if (!exists) {
        const tech = await db.employee.findFirst({ where: { role: "maintenance-tech" } });
        await db.workOrder.create({
          data: { code: `WO-${Date.now().toString(36).toUpperCase()}`, kind: "calibration", assetId: asset.id, technicianId: tech?.id ?? null, priority: "normal", status: "assigned", slaDueAt: new Date(asset.calibrationDueAt), checklist: { steps: [{ t: "معايرة موثقة بشهادة", done: false }] } },
        });
        await db.asset.update({ where: { id: asset.id }, data: { status: "awaiting-calibration" } });
        await notify(tech?.id ?? null, "maintenance-tech", "calibration-due", `معايرة قريبة: ${asset.nameAr}`, `Calibration due: ${asset.nameEn}`);
        result.pm++;
      }
    }
  }

  // 4) License expiry warnings (employees)
  const emps = await db.employee.findMany({ where: { licenseExpiresAt: { not: null } } });
  for (const e of emps) {
    const days = (e.licenseExpiresAt!.getTime() - now) / 86400000;
    if (days < 0 && e.active && !e.licenseSuspendedAt) {
      await db.employee.update({ where: { id: e.id }, data: { licenseSuspendedAt: new Date(), active: false } });
      await notify(null, "hr", "license-expired", `ترخيص منتهٍ — إيقاف صلاحيات: ${e.nameAr}`, `License expired — signing suspended: ${e.nameEn}`);
      result.warnings++;
    } else if (days > 0 && days < 30 && Math.floor(days) % 10 === 0) {
      await notify(null, "hr", "license-warning", `ترخيص ينتهي خلال ${Math.floor(days)} يوماً: ${e.nameAr}`, `License expires in ${Math.floor(days)}d: ${e.nameEn}`);
      result.warnings++;
    }
  }

  // 5) Low stock (drugs)
  const drugs = await db.drug.findMany({ where: { stockQty: { lt: 15 } } });
  for (const d of drugs.slice(0, 5)) {
    await notify(null, "pharmacist", "low-stock", `مخزون منخفض: ${d.nameAr}`, `Low stock: ${d.nameEn}`, `الكمية ${d.stockQty} دون الحد الأدنى`, `Qty ${d.stockQty} below par`);
  }

  return result;
}

export function startScheduler(): void {
  if (started) return;
  started = true;
  const loop = async () => {
    try { await runSchedulerTick(); } catch (e) { console.error("[scheduler]", (e as Error).message); }
  };
  void loop();
  setInterval(loop, 60_000);
  console.log("[scheduler] started (60s interval)");
}
