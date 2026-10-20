/**
 * Devices — kiosk check-in, queue display state, verify + AI assistant + system.
 */
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { problem, jo, ja, actorFrom } from "@/lib/api";
import { blindIndex, maskCpr } from "@/lib/bahrain";
import { nextTicket, nextEncounterCode } from "@/lib/numbering";
import { verifyCodeOk } from "@/lib/algorithms";
import type { RouteTable } from "./router";
import { json } from "./router";

const routes: RouteTable = {
  // Kiosk: barcode from patient app/permanent card, or CPR entry
  "POST kiosk/check-in": async (req) => {
    const b = jo(await req.json()) as { barcode?: string; cpr?: string; mrn?: string };
    let patientId: string | null = null;
    let method = "";
    if (b.cpr) {
      const digits = b.cpr.replace(/\D/g, "");
      if (digits.length !== 9) return problem("ID_INVALID_CPR");
      const bi = blindIndex("CPR", digits, "BH");
      patientId = (await db.patientIdentifier.findUnique({ where: { blindIndex: bi } }))?.patientId ?? null;
      method = "cpr";
    } else if (b.barcode?.startsWith("BMC-APPT-")) {
      const appt = await db.appointment.findUnique({ where: { id: b.barcode.replace("BMC-APPT-", "").toLowerCase() } });
      patientId = appt?.patientId ?? null;
      method = "barcode";
    } else if (b.mrn) {
      const p = await db.patient.findUnique({ where: { mrn: b.mrn.toUpperCase() } });
      patientId = p?.id ?? null;
      method = "card";
    }
    if (!patientId) return problem("NOT_FOUND", { detail: "patient not found" });
    const appt = await db.appointment.findFirst({ where: { patientId, start: { gte: new Date(Date.now() - 3600000), lt: new Date(Date.now() + 86400000) }, status: { in: ["requested", "confirmed"] } }, orderBy: { start: "asc" } });
    if (!appt) return problem("NOT_FOUND", { detail: "no active appointment today" });
    if (appt.start.getTime() - Date.now() > 45 * 60000) return problem("STATE_INVALID", { detail: "early — kiosk opens check-in 45 min before", code: "TOO_EARLY" }, 409);
    await db.appointment.update({ where: { id: appt.id }, data: { status: "arrived", checkinAt: new Date(), checkinMethod: method } });
    let enc = await db.encounter.findFirst({ where: { appointmentId: appt.id } });
    if (!enc) {
      const code = await nextEncounterCode();
      enc = await db.encounter.create({ data: { code, patientId, departmentId: appt.departmentId, appointmentId: appt.id, status: "arrived", type: "consultation", startedAt: new Date() } });
    }
    const dept = await db.department.findUnique({ where: { id: appt.departmentId } });
    const code = await nextTicket("C");
    const ticket = await db.queueTicket.create({ data: { code, patientId, appointmentId: appt.id, servicePointId: (await db.servicePoint.findFirst({ where: { code: "C" } }))!.id, priority: "normal", status: "waiting", source: "kiosk" } });
    await audit({ action: "kiosk-checkin", resource: "appointment", resourceId: appt.id, patientId, after: { method, ticket: ticket.code } });
    try {
      await fetch("http://localhost:3003/emit", { method: "POST", headers: { "content-type": "application/json", "x-bmc-internal": process.env.BMC_INTERNAL_KEY ?? "bmc-dev-internal" }, body: JSON.stringify({ event: "queue:called", room: "display", payload: { point: "العيادة", code: ticket.code, room: dept?.roomLabel ?? "٣", patientName: "" } }) });
    } catch { /* optional */ }
    return json({ ok: true, ticket: { code: ticket.code }, room: dept?.roomLabel ?? "٣", mrn: (await db.patient.findUnique({ where: { id: patientId } }))!.mrn, idMasked: patientId ? maskCpr(((await db.patientIdentifier.findFirst({ where: { patientId } }))?.number ?? "")) : "" }, 201);
  },
  "GET queue/display": async () => {
    const points = await db.servicePoint.findMany();
    const tickets = await db.queueTicket.findMany({ where: { status: { in: ["waiting", "called", "serving"] } }, orderBy: { issuedAt: "desc" } });
    const display = points.map((p) => {
      const serving = tickets.filter((t) => t.servicePointId === p.id && t.status === "serving").slice(-1)[0];
      const called = tickets.filter((t) => t.servicePointId === p.id && t.status === "called").slice(-1)[0];
      const current = serving ?? called;
      return { pointAr: p.nameAr, pointEn: p.nameEn, code: current?.code ?? "—", room: current?.roomLabel ?? (called ? called.roomLabel : "—"), waitingCount: tickets.filter((t) => t.servicePointId === p.id && t.status === "waiting").length };
    });
    return json({ display, generatedAt: new Date().toISOString() });
  },
  "POST verify/check": async (req) => {
    const b = jo(await req.json()) as { code?: string };
    const code = (b.code ?? "").trim().toUpperCase();
    if (!verifyCodeOk(code)) return json({ valid: false, reason: "FORMAT" });
    const doc = await db.document.findUnique({ where: { verifyCode: code } });
    if (!doc || doc.revokedAt) return json({ valid: false, reason: "NOT_FOUND_OR_REVOKED" });
    const emp = await db.employee.findUnique({ where: { id: doc.issuedBy ?? "x" } });
    await audit({ action: "verify-doc", resource: "document", resourceId: doc.id, after: { code } });
    return json({ valid: true, kind: doc.kind, titleAr: doc.titleAr, titleEn: doc.titleEn, issuedAt: doc.issuedAt.toISOString().slice(0, 10), doctorNameAr: emp?.nameAr ?? "—", doctorLicense: emp?.licenseNo ?? "—", expiresAt: doc.expiryAt?.toISOString().slice(0, 10) ?? null });
  },
  // Realtime relay status (devices page)
  "GET system/health": async () => {
    const [patients, appts, tickets, alerts, won, realtimeOk] = await Promise.all([
      db.patient.count(), db.appointment.count(), db.queueTicket.count(), db.criticalAlert.count({ where: { status: { in: ["new", "escalated-1", "escalated-2"] } } }), db.workOrder.count({ where: { status: { in: ["open", "assigned", "in-progress", "awaiting-part"] } } }),
      fetch("http://localhost:3003/").then((r) => r.ok).catch(() => false),
    ]);
    return json({ ok: true, db: true, realtime: realtimeOk, counts: { patients, appts, tickets, criticalAlerts: alerts, openWorkOrders: won }, now: new Date().toISOString() });
  },
};
void ja;
export default routes;
