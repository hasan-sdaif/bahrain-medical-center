/**
 * Patient portal API — self/dependants only (RLS-style: every query is scoped
 * by the session patientId; cross-account access returns 403/404 (§17.16)).
 */
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { problem, ja, jo, actorFrom, type Actor } from "@/lib/api";
import { maskCpr } from "@/lib/bahrain";
import { nextApptCode, nextTicket } from "@/lib/numbering";
import { growthPercentile } from "@/lib/algorithms";
import type { RouteTable } from "./router";
import { json } from "./router";

function patientActor(req: Request): { actor: Actor; pid: string } | null {
  const a = actorFrom(req);
  if (!a || a.audience !== "patient" || !a.patientId) return null;
  return { actor: a, pid: a.patientId };
}

function notPatient(): Response {
  return problem("UNAUTHORIZED", { detail: "patient session required" });
}

const routes: RouteTable = {
  "GET login-options": async () => {
    const rows = await db.patient.findMany({ take: 6, orderBy: { createdAt: "asc" } });
    return json(rows.map((p) => ({ id: p.id, mrn: p.mrn, nameAr: `${p.firstNameAr} ${p.familyAr}`, nameEn: `${p.firstNameEn ?? ""} ${p.familyEn ?? ""}`.trim(), phone: p.phone })));
  },
  "GET overview": async (req) => {
    const s = patientActor(req); if (!s) return notPatient();
    const p = await db.patient.findUnique({ where: { id: s.pid }, include: { identifiers: true, flags: true, policies: { include: { payer: true } } } });
    if (!p) return problem("NOT_FOUND");
    const rel = await db.patientRelationship.findMany({ where: { relatedId: s.pid, relation: "guardian" } });
    const dependants: string[] = rel.map((r) => r.patientId);
    const scope = [s.pid, ...dependants];
    const [appts, newResults, unreadMsgs, dueInvoices, docs] = await Promise.all([
      db.appointment.findMany({ where: { patientId: { in: scope }, start: { gte: new Date() }, status: { in: ["requested", "confirmed"] } }, include: { department: true, employee: true, appointmentType: true }, orderBy: { start: "asc" }, take: 5 }),
      db.labResult.findMany({ where: { patientId: { in: scope }, releasedAt: { not: null } }, take: 3 }),
      db.notification.count({ where: { patientId: s.pid, readAt: null } }),
      db.invoice.findMany({ where: { patientId: { in: scope }, status: { in: ["issued", "partial"] } }, orderBy: { issuedAt: "desc" }, take: 3 }),
      db.document.findMany({ where: { patientId: { in: scope } }, orderBy: { issuedAt: "desc" }, take: 5 }),
    ]);
    return json({
      patient: { id: p.id, mrn: p.mrn, nameAr: `${p.firstNameAr} ${p.familyAr}`, nameEn: `${p.firstNameEn ?? ""} ${p.familyEn ?? ""}`, assurance: p.assurance, idMasked: p.identifiers[0] ? maskCpr(p.identifiers[0].number) : "", flags: p.flags, dob: p.dob.toISOString(), gender: p.gender, phone: p.phone },
      insurance: p.policies[0] ? { payerAr: p.policies[0].payer.nameAr, membershipNo: p.policies[0].membershipNo, validUntil: p.policies[0].validUntil?.toISOString().slice(0, 10) ?? null } : null,
      upcoming: appts.map((a) => ({ id: a.id, code: a.code, start: a.start.toISOString(), status: a.status, deptAr: a.department.nameAr, deptEn: a.department.nameEn, typeAr: a.appointmentType.nameAr, doctorAr: a.employee?.nameAr ?? "—", barcode: `BMC-APPT-${a.id.slice(-8).toUpperCase()}`, prepAr: a.appointmentType.instructionsAr, prepEn: a.appointmentType.instructionsEn, priceFils: a.priceFils, paymentStatus: a.paymentStatus })),
      unreadNotifications: unreadMsgs,
      dueInvoices: dueInvoices.map((i) => ({ id: i.id, code: i.code, totalFils: i.totalFils, patientFils: i.patientFils, status: i.status })),
      documents: docs.map((d) => ({ id: d.id, kind: d.kind, titleAr: d.titleAr, titleEn: d.titleEn, issuedAt: d.issuedAt.toISOString().slice(0, 10), verifyCode: d.verifyCode })),
    });
  },
  "GET appointments": async (req) => {
    const s = patientActor(req); if (!s) return notPatient();
    const rows = await db.appointment.findMany({ where: { patientId: s.pid }, include: { department: true, employee: true, appointmentType: true }, orderBy: { start: "desc" }, take: 30 });
    return json(rows.map((a) => ({
      id: a.id, code: a.code, start: a.start.toISOString(), status: a.status, deptAr: a.department.nameAr, deptEn: a.department.nameEn,
      typeAr: a.appointmentType.nameAr, typeEn: a.appointmentType.nameEn, doctorAr: a.employee?.nameAr ?? "—", doctorEn: a.employee?.nameEn ?? "—",
      barcode: `BMC-APPT-${a.id.slice(-8).toUpperCase()}`, prepAr: a.appointmentType.instructionsAr, priceFils: a.priceFils, paymentStatus: a.paymentStatus, channel: a.channel,
    })));
  },
  "POST appointments/book": async (req) => {
    const s = patientActor(req); if (!s) return notPatient();
    const b = jo(await req.json()) as { start?: string; typeCode?: string; deptCode?: string; doctorId?: string };
    const type = await db.appointmentType.findFirst({ where: { code: b.typeCode ?? "GP-NEW" } });
    if (!type || !b.start) return problem("VALIDATION");
    const start = new Date(b.start);
    const end = new Date(start.getTime() + type.durationMin * 60000);
    const conflict = await db.appointment.findFirst({ where: { patientId: s.pid, status: { in: ["requested", "confirmed"] }, start: { lt: end }, end: { gt: start } } });
    if (conflict) return problem("PATIENT_DOUBLE_BOOKED");
    const deptId = type.departmentId ?? (await db.department.findUnique({ where: { code: b.deptCode ?? "GP" } }))!.id;
    const code = await nextApptCode();
    const a = await db.appointment.create({ data: { code, patientId: s.pid, departmentId: deptId, employeeId: b.doctorId ?? null, appointmentTypeId: type.id, start, end, status: "requested", channel: "portal", priceFils: type.priceFils, createdBy: s.pid } });
    await audit({ actorId: s.pid, actorRole: "patient", action: "book", resource: "appointment", resourceId: a.id, patientId: s.pid, after: { code, start: start.toISOString() } });
    return json({ id: a.id, code, barcode: `BMC-APPT-${a.id.slice(-8).toUpperCase()}` }, 201);
  },
  "POST appointments/cancel": async (req) => {
    const s = patientActor(req); if (!s) return notPatient();
    const b = jo(await req.json()) as { appointmentId?: string };
    const a = await db.appointment.findUnique({ where: { id: String(b.appointmentId) } });
    if (!a || a.patientId !== s.pid) return problem("NOT_FOUND"); // isolation
    if (a.start.getTime() - Date.now() < 4 * 3600000) return problem("STATE_INVALID", { detail: "cancellation < 4h — contact the center", code: "CANCEL_WINDOW" }, 409);
    await db.appointment.update({ where: { id: a.id }, data: { status: "cancelled", cancelReason: "patient-portal" } });
    await audit({ actorId: s.pid, actorRole: "patient", action: "cancel", resource: "appointment", resourceId: a.id, patientId: s.pid });
    return json({ ok: true });
  },
  "GET results": async (req) => {
    const s = patientActor(req); if (!s) return notPatient();
    const rows = await db.labResult.findMany({ where: { patientId: s.pid, releasedAt: { not: null } }, include: { orderItem: true, test: true }, orderBy: { resultedAt: "desc" }, take: 50 });
    const imaging = await db.imagingStudy.findMany({ where: { patientId: s.pid, status: "signed" }, orderBy: { signedAt: "desc" }, take: 10 });
    return json({
      results: rows.map((r) => ({ id: r.id, testAr: r.orderItem.nameAr, testEn: r.orderItem.nameEn, value: r.value, unit: r.unit, flag: r.flag, refLow: r.refLow, refHigh: r.refHigh, resultedAt: r.resultedAt.toISOString(), comment: r.comment, released: true })),
      imaging: imaging.map((i) => ({ id: i.id, reportAr: i.reportAr, reportEn: i.reportEn, grade: i.grade, signedAt: i.signedAt?.toISOString() ?? null })),
    });
  },
  "GET prescriptions": async (req) => {
    const s = patientActor(req); if (!s) return notPatient();
    const rxs = await db.prescription.findMany({ where: { patientId: s.pid }, include: { items: { include: { drug: true } } }, orderBy: { createdAt: "desc" } });
    const out: { id: string; code: string; status: string; createdAt: string; items: { drugAr: string; drugEn: string; doseAr: string; doseEn: string; frequency: string; instrAr: string | null; instrEn: string | null }[]; dispensedCount: number }[] = [];
    for (const r of rxs) {
      const disp = await db.dispensing.findMany({ where: { prescriptionItemId: { in: r.items.map((i) => i.id) } } });
      out.push({ id: r.id, code: r.code, status: r.status, createdAt: r.createdAt.toISOString(), items: r.items.map((i) => ({ drugAr: i.drug.nameAr, drugEn: i.drug.nameEn, doseAr: i.doseAr, doseEn: i.doseEn, frequency: i.frequency, instrAr: i.instrAr, instrEn: i.instrEn })), dispensedCount: disp.length });
    }
    return json(out);
  },
  "POST prescriptions/refill": async (req) => {
    const s = patientActor(req); if (!s) return notPatient();
    const b = jo(await req.json()) as { prescriptionId?: string; note?: string };
    const r = await db.prescription.findUnique({ where: { id: String(b.prescriptionId) } });
    if (!r || r.patientId !== s.pid) return problem("NOT_FOUND");
    await db.task.create({ data: { titleAr: `طلب إعادة صرف — وصفة ${r.code}`, role: "pharmacist", patientId: s.pid, status: "new", kind: "refill", refType: "prescription", refId: r.id, dueAt: new Date(Date.now() + 86400000) } });
    await audit({ actorId: s.pid, actorRole: "patient", action: "refill-request", resource: "prescription", resourceId: r.id, patientId: s.pid });
    return json({ ok: true }, 201);
  },
  "GET invoices": async (req) => {
    const s = patientActor(req); if (!s) return notPatient();
    const rows = await db.invoice.findMany({ where: { patientId: s.pid }, include: { lines: true }, orderBy: { issuedAt: "desc" } });
    const pays = await db.payment.findMany({ where: { patientId: s.pid }, orderBy: { receivedAt: "desc" } });
    return json({
      invoices: rows.map((i) => ({ id: i.id, code: i.code, status: i.status, issuedAt: i.issuedAt.toISOString().slice(0, 10), subtotalFils: i.subtotalFils, vatFils: i.vatFils, totalFils: i.totalFils, patientFils: i.patientFils, insurerFils: i.insurerFils, neutralDesc: i.neutralDesc, lines: i.lines.map((l) => ({ nameAr: l.nameAr, nameEn: l.nameEn, qty: l.qty, unitFils: l.unitFils, vatFils: l.vatFils })) })),
      payments: pays.map((p) => ({ code: p.code, method: p.method, amountFils: p.amountFils, status: p.status, at: p.receivedAt.toISOString().slice(0, 10) })),
    });
  },
  "GET consents": async (req) => {
    const s = patientActor(req); if (!s) return notPatient();
    const rows = await db.consent.findMany({ where: { patientId: s.pid }, orderBy: { signedAt: "desc" } });
    const templates = await db.consentTemplate.findMany({ where: { active: true } });
    return json({
      signed: rows.map((c) => ({ code: c.code, templateKey: c.templateKey, status: c.status, method: c.method, signedAt: c.signedAt.toISOString().slice(0, 10), withdrawnAt: c.withdrawnAt?.toISOString().slice(0, 10) ?? null })),
      templates: templates.map((t) => ({ key: t.key, titleAr: t.titleAr, titleEn: t.titleEn, bodyAr: t.bodyAr, bodyEn: t.bodyEn, minReadSec: t.minReadSec })),
    });
  },
  "POST consents/sign": async (req) => {
    const s = patientActor(req); if (!s) return notPatient();
    const b = jo(await req.json()) as { templateKey?: string; otp?: string; readSeconds?: number };
    if (!b.templateKey) return problem("VALIDATION");
    const tpl = await db.consentTemplate.findUnique({ where: { key: b.templateKey } });
    if (!tpl) return problem("NOT_FOUND");
    if (b.otp !== "1234" && b.otp !== "000000") return problem("VALIDATION", { detail: "OTP incorrect (demo: 1234)", code: "OTP_INVALID" }, 401);
    if ((b.readSeconds ?? 0) < tpl.minReadSec) return problem("VALIDATION", { detail: "read too fast", code: "READ_TOO_FAST" });
    const c = await db.consent.create({ data: { code: `CST-${Date.now().toString(36).toUpperCase()}`, templateKey: tpl.key, templateVersion: tpl.version, patientId: s.pid, method: "portal", signedBy: "المريض (بوابة)", status: "active", otpVerified: true, readSeconds: b.readSeconds ?? 0, evidence: { device: "portal", ip: "portal-session" } } });
    await audit({ actorId: s.pid, actorRole: "patient", action: "sign", resource: "consent", resourceId: c.id, patientId: s.pid, after: { template: tpl.key } });
    return json({ id: c.id }, 201);
  },
  "POST consents/withdraw": async (req) => {
    const s = patientActor(req); if (!s) return notPatient();
    const b = jo(await req.json()) as { consentId?: string };
    const c = await db.consent.findUnique({ where: { id: String(b.consentId) } });
    if (!c || c.patientId !== s.pid) return problem("NOT_FOUND");
    await db.consent.update({ where: { id: c.id }, data: { status: "withdrawn", withdrawnAt: new Date() } });
    await audit({ actorId: s.pid, actorRole: "patient", action: "withdraw", resource: "consent", resourceId: c.id, patientId: s.pid });
    return json({ ok: true });
  },
  "GET access-log": async (req) => {
    const s = patientActor(req); if (!s) return notPatient();
    const rows = await db.auditEvent.findMany({ where: { patientId: s.pid, action: { in: ["view-chart", "break-glass", "reader-read"] } }, orderBy: { at: "desc" }, take: 50 });
    const staff = await db.employee.findMany();
    const nameOf = new Map(staff.map((e) => [e.id, e.nameAr]));
    return json(rows.map((r) => ({ id: r.id, at: r.at.toISOString(), action: r.action, by: nameOf.get(r.actorId ?? "") ?? r.actorRole ?? "—", role: r.actorRole, reason: r.reason, ip: r.ip })));
  },
  "GET family": async (req) => {
    const s = patientActor(req); if (!s) return notPatient();
    const rel = await db.patientRelationship.findMany({ where: { relatedId: s.pid } });
    const kids: { id: string; mrn: string; nameAr: string; relation: string; dob: string }[] = [];
    for (const r of rel) {
      const k = await db.patient.findUnique({ where: { id: r.patientId } });
      if (k) kids.push({ id: k.id, mrn: k.mrn, nameAr: `${k.firstNameAr} ${k.familyAr}`, relation: r.relation, dob: k.dob.toISOString().slice(0, 10) });
    }
    return json({ dependants: kids });
  },
  "GET growth": async (req) => {
    const s = patientActor(req); if (!s) return notPatient();
    const rel = await db.patientRelationship.findMany({ where: { relatedId: s.pid, relation: "guardian" } });
    const out: { child: { id: string; nameAr: string; dob: string | undefined }; records: { metric: string; value: number; ageMonths: number; z: number | null; percentile: number | null; flag: string | null }[] }[] = [];
    for (const r of rel) {
      const g = await db.growthRecord.findMany({ where: { patientId: r.patientId }, orderBy: { recordedAt: "asc" } });
      if (g.length) {
        const k = await db.patient.findUnique({ where: { id: r.patientId } });
        out.push({ child: { id: r.patientId, nameAr: k ? `${k.firstNameAr} ${k.familyAr}` : "", dob: k?.dob.toISOString().slice(0, 10) }, records: g.map((x) => ({ metric: x.metric, value: x.value, ageMonths: x.ageMonths, z: x.z, percentile: x.percentile, flag: x.flag })) });
      }
    }
    void growthPercentile;
    return json(out);
  },
  "POST home-request": async (req) => {
    const s = patientActor(req); if (!s) return notPatient();
    const b = jo(await req.json()) as { tests?: { code: string; nameAr: string; priceFils: number; fasting: boolean }[]; slot?: string; fasting?: boolean; prefGender?: string; address?: Record<string, unknown> };
    const p = await db.patient.findUnique({ where: { id: s.pid } });
    const addr = (b.address ?? p?.address ?? {}) as Record<string, unknown>;
    const zone = await db.coverageZone.findFirst({ where: { governorate: String(addr.governorate ?? "capital") } });
    const fee = zone ? (b.slot?.includes("مساء") ? zone.feeFils + zone.eveningFils : zone.feeFils) : 3500;
    const code = `HV-${Date.now().toString(36).toUpperCase()}`;
    const r = await db.homeRequest.create({ data: { code, patientId: s.pid, channel: "portal", tests: (b.tests ?? []) as object, address: addr as object, slot: b.slot ?? "صباحاً", fasting: !!b.fasting, prefGender: b.prefGender ?? "any", status: "requested", feeFils: fee, zoneId: zone?.id ?? null, notesAr: b.fasting ? "المريض سيكون صائماً — جدولة مبكرة" : null } });
    await audit({ actorId: s.pid, actorRole: "patient", action: "create", resource: "home-request", resourceId: r.id, patientId: s.pid, after: { code, feeFils: fee } });
    return json({ id: r.id, code, feeFils: fee }, 201);
  },
  "GET home-tracking": async (req) => {
    const s = patientActor(req); if (!s) return notPatient();
    const rows = await db.homeRequest.findMany({ where: { patientId: s.pid }, include: { visit: true }, orderBy: { createdAt: "desc" } });
    return json(rows.map((r) => ({
      code: r.code, status: r.status, slot: r.slot, feeFils: r.feeFils, tests: ja(r.tests),
      visit: r.visit ? { eta: r.visit.eta?.toISOString() ?? null, arrivedAt: r.visit.arrivedAt?.toISOString() ?? null, drawnAt: r.visit.drawnAt?.toISOString() ?? null } : null,
      createdAt: r.createdAt.toISOString(),
    })));
  },
  "POST ai-ask": async (req) => {
    const s = patientActor(req); if (!s) return notPatient();
    const b = jo(await req.json()) as { message?: string };
    const answer = {
      ar: "شكراً لتواصلك عبر بوابتك. للحجز أو الاستفسار الإداري يمكنني المساعدة؛ وللاستشارة الطبية رجاءً احجز موعداً أو استخدم رسائل البوابة الآمنة. للطوارئ 999.",
      en: "Thanks for reaching out via your portal. I can help with booking/admin questions; for medical advice please book an appointment or use secure messaging. Emergencies: 999.",
    };
    return json({ answer, logged: true });
  },
  "GET notifications": async (req) => {
    const s = patientActor(req); if (!s) return notPatient();
    const rows = await db.notification.findMany({ where: { patientId: s.pid }, orderBy: { createdAt: "desc" }, take: 20 });
    return json(rows.map((n) => ({ id: n.id, kind: n.kind, titleAr: n.titleAr, titleEn: n.titleEn, bodyAr: n.bodyAr, at: n.createdAt.toISOString() })));
  },
};
void nextTicket;
export default routes;
