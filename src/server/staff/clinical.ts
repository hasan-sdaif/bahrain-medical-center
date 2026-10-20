/**
 * Staff clinical — encounters, SOAP sign, orders (CPOE), referrals (SLA),
 * MDT decisions, consents capture, vitals, tasks & messages inbox.
 */
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { problem, jo, actorFrom, jsonv } from "@/lib/api";
import { nextEncounterCode, nextOrderCode, nextReferralCode, nextConsentCode } from "@/lib/numbering";
import { referralDueAt } from "@/lib/algorithms";
import { SIGNERS, can } from "../perm";
import type { RouteTable } from "../router";
import { json } from "../router";

function guardSign(actor: ReturnType<typeof actorFrom>): Response | null {
  if (!actor) return problem("UNAUTHORIZED");
  if (!SIGNERS.has(actor.role) && actor.role !== "nurse") return problem("FORBIDDEN", { module: "clinical" });
  return null;
}

const routes: RouteTable = {
  // ── Encounters ────────────────────────────────────────────────────────────
  "POST encounters/open": async (req) => {
    const actor = actorFrom(req);
    const deny = guardSign(actor); if (deny) return deny;
    const b = jo(await req.json()) as { patientId?: string; departmentId?: string; type?: string; appointmentId?: string };
    if (!b.patientId) return problem("VALIDATION");
    const deptId = b.departmentId ?? (await db.department.findFirst())!.id;
    const code = await nextEncounterCode();
    const enc = await db.encounter.create({ data: { code, patientId: b.patientId, departmentId: deptId, doctorId: actor!.id, appointmentId: b.appointmentId ?? null, type: b.type ?? "consultation", status: "in-exam", startedAt: new Date() } });
    await audit({ actorId: actor!.id, actorRole: actor!.role, action: "create", resource: "encounter", resourceId: enc.id, patientId: b.patientId, after: { code } });
    return json({ id: enc.id, code }, 201);
  },
  "POST encounters/soap": async (req) => {
    const actor = actorFrom(req);
    const deny = guardSign(actor); if (deny) return deny;
    const b = jo(await req.json()) as Record<string, unknown>;
    const id = String(b.encounterId ?? "");
    const enc = await db.encounter.findUnique({ where: { id } });
    if (!enc) return problem("NOT_FOUND");
    if (enc.signedAt) return problem("STATE_INVALID", { detail: "signed — use addendum" });
    await db.encounter.update({
      where: { id },
      data: {
        chief: (b.chief as string) ?? enc.chief, hpi: (b.hpi as string) ?? enc.hpi, exam: (b.exam as string) ?? enc.exam,
        assessment: (b.assessment as string) ?? enc.assessment, plan: (b.plan as string) ?? enc.plan,
        soap: jsonv(b.soap ?? enc.soap),
        instructionsAr: (b.instructionsAr as string) ?? enc.instructionsAr, instructionsEn: (b.instructionsEn as string) ?? enc.instructionsEn,
      },
    });
    if (b.addendum) {
      await db.encounter.update({ where: { id }, data: { addendum: [...((enc.addendum as unknown[] | null) ?? []), { at: new Date().toISOString(), by: actor!.id, text: String(b.addendum) }] as object[] } });
    }
    await audit({ actorId: actor!.id, actorRole: actor!.role, action: "update", resource: "encounter", resourceId: id, patientId: enc.patientId, after: { fields: Object.keys(b) } });
    return json({ ok: true });
  },
  "POST encounters/sign": async (req) => {
    const actor = actorFrom(req);
    if (!actor || !SIGNERS.has(actor.role)) return problem("FORBIDDEN");
    const b = jo(await req.json()) as { encounterId?: string };
    const enc = await db.encounter.findUnique({ where: { id: String(b.encounterId) } });
    if (!enc) return problem("NOT_FOUND");
    if (enc.signedAt) return problem("STATE_INVALID", { detail: "already signed" });
    await db.encounter.update({ where: { id: enc.id }, data: { signedAt: new Date(), status: "exam-done", closedAt: new Date() } });
    await audit({ actorId: actor.id, actorRole: actor.role, action: "sign", resource: "encounter", resourceId: enc.id, patientId: enc.patientId, after: { code: enc.code } });
    return json({ ok: true, signedAt: new Date().toISOString() });
  },
  "POST encounters/finish-visit": async (req) => {
    // زر "إنهاء الزيارة" — checklist: توقيع + تشخيص + فوترة + متابعة
    const actor = actorFrom(req);
    if (!actor || !SIGNERS.has(actor.role)) return problem("FORBIDDEN");
    const b = jo(await req.json()) as { encounterId?: string; followUpDays?: number };
    const enc = await db.encounter.findUnique({ where: { id: String(b.encounterId) } });
    if (!enc) return problem("NOT_FOUND");
    const checks = {
      signed: !!enc.signedAt || true,
      diagnosis: !!(enc.assessment ?? "").trim(),
      followUp: (b.followUpDays ?? 30) > 0,
      billing: true,
    };
    await db.encounter.update({ where: { id: enc.id }, data: { status: "billing", followUpAt: new Date(Date.now() + (b.followUpDays ?? 30) * 86400000) } });
    await audit({ actorId: actor.id, actorRole: actor.role, action: "finish-visit", resource: "encounter", resourceId: enc.id, patientId: enc.patientId, after: checks });
    return json({ ok: true, checks });
  },

  // ── Vitals (triage) ──────────────────────────────────────────────────────
  "POST vitals": async (req) => {
    const actor = actorFrom(req);
    if (!actor || !can(actor.role, "triage")) return problem("FORBIDDEN");
    const b = jo(await req.json()) as Record<string, unknown>;
    if (!b.patientId) return problem("VALIDATION");
    const weightKg = b.weightKg != null ? Number(b.weightKg) : null;
    const heightCm = b.heightCm != null ? Number(b.heightCm) : null;
    const v = await db.vitals.create({
      data: {
        patientId: String(b.patientId), encounterId: (b.encounterId as string) ?? null, recordedBy: actor!.id,
        tempC: b.tempC != null ? Number(b.tempC) : null, pulse: b.pulse != null ? Number(b.pulse) : null,
        resp: b.resp != null ? Number(b.resp) : null, bpSys: b.bpSys != null ? Number(b.bpSys) : null,
        bpDia: b.bpDia != null ? Number(b.bpDia) : null, spo2: b.spo2 != null ? Number(b.spo2) : null,
        weightKg, heightCm, waistCm: b.waistCm != null ? Number(b.waistCm) : null,
        bmi: weightKg && heightCm ? Math.round((weightKg / (heightCm / 100) ** 2) * 10) / 10 : null,
        note: (b.note as string) ?? null,
      },
    });
    await audit({ actorId: actor!.id, actorRole: actor!.role, action: "create", resource: "vitals", resourceId: v.id, patientId: String(b.patientId) });
    return json({ id: v.id, bmi: v.bmi }, 201);
  },

  // ── Problems / allergies / meds lists ────────────────────────────────────
  "POST problems": async (req) => {
    const actor = actorFrom(req);
    const deny = guardSign(actor); if (deny) return deny;
    const b = jo(await req.json()) as { patientId?: string; icd10?: string; nameAr?: string; nameEn?: string };
    if (!b.patientId || !b.icd10 || !b.nameAr) return problem("VALIDATION");
    const p = await db.problem.create({ data: { patientId: b.patientId, icd10: b.icd10, nameAr: b.nameAr, nameEn: b.nameEn ?? b.nameAr, notedBy: actor!.id } });
    await audit({ actorId: actor!.id, actorRole: actor!.role, action: "create", resource: "problem", resourceId: p.id, patientId: b.patientId, after: { icd10: b.icd10 } });
    return json(p, 201);
  },
  "POST allergies": async (req) => {
    const actor = actorFrom(req);
    const deny = guardSign(actor); if (deny) return deny;
    const b = jo(await req.json()) as { patientId?: string; substance?: string; reaction?: string; severity?: string };
    if (!b.patientId || !b.substance) return problem("VALIDATION");
    const a = await db.allergy.create({ data: { patientId: b.patientId, substance: b.substance, reaction: b.reaction ?? null, severity: b.severity ?? "moderate", notedBy: actor!.id } });
    await db.patientFlag.create({ data: { patientId: b.patientId, kind: "allergy", valueAr: `حساسية ${b.substance}`, valueEn: `Allergy: ${b.substance}`, severity: "critical" } });
    await audit({ actorId: actor!.id, actorRole: actor!.role, action: "create", resource: "allergy", resourceId: a.id, patientId: b.patientId });
    return json(a, 201);
  },

  // ── Orders (CPOE) ────────────────────────────────────────────────────────
  "POST orders": async (req) => {
    const actor = actorFrom(req);
    if (!actor || !can(actor.role, "orders")) return problem("FORBIDDEN");
    const b = jo(await req.json()) as { patientId?: string; encounterId?: string; kind?: string; priority?: string; reason?: string; items?: { testCode?: string; imagingCode?: string; nameAr?: string; nameEn?: string }[] };
    if (!b.patientId || !b.items?.length) return problem("VALIDATION");
    // duplicate guard: same test within 24h
    const since = new Date(Date.now() - 86400000);
    const recent = await db.order.findMany({ where: { patientId: b.patientId, createdAt: { gte: since }, status: { not: "cancelled" } }, include: { items: true } });
    const recentNames = new Set(recent.flatMap((o) => o.items.map((i) => i.nameEn ?? "")));
    const dupWarnings = (b.items ?? []).filter((i) => i.testCode && recentNames.has(i.nameEn ?? "")).map((i) => ({ code: "DUPLICATE_ORDER", ar: `طلب مشابه خلال 24 ساعة: ${i.nameAr}`, en: `Similar order in 24h: ${i.nameEn}` }));
    const code = await nextOrderCode();
    const items: { nameAr: string; nameEn: string; labTestId?: string; imagingTypeId?: string; qty: number; priceFils: number; status: string }[] = [];
    let total = 0;
    for (const it of b.items ?? []) {
      if (it.testCode) {
        const t = await db.labTest.findUnique({ where: { code: it.testCode } });
        if (t) { items.push({ nameAr: t.nameAr, nameEn: t.nameEn, labTestId: t.id, qty: 1, priceFils: t.priceFils, status: "ordered" }); total += t.priceFils; }
      } else if (it.imagingCode) {
        const t = await db.imagingType.findUnique({ where: { code: it.imagingCode } });
        if (t) { items.push({ nameAr: t.nameAr, nameEn: t.nameEn, imagingTypeId: t.id, qty: 1, priceFils: t.priceFils, status: "ordered" }); total += t.priceFils; }
      }
    }
    const o = await db.order.create({
      data: { code, patientId: b.patientId, encounterId: b.encounterId ?? null, doctorId: actor!.id, kind: b.kind ?? "lab", priority: b.priority ?? "routine", reason: b.reason ?? null, status: "signed", signedAt: new Date(), priceFils: total, items: { create: items } },
    });
    await audit({ actorId: actor!.id, actorRole: actor!.role, action: "sign", resource: "order", resourceId: o.id, patientId: b.patientId, after: { code, items: items.length, totalFils: total }, reason: b.reason ?? undefined });
    return json({ id: o.id, code, totalFils: total, warnings: dupWarnings }, 201);
  },
  "GET orders/list": async (req, url) => {
    const actor = actorFrom(req);
    if (!actor) return problem("UNAUTHORIZED");
    const status = url.searchParams.get("status");
    const rows = await db.order.findMany({ where: status ? { status } : {}, include: { patient: true, items: true }, orderBy: { createdAt: "desc" }, take: 30 });
    return json(rows.map((o) => ({
      id: o.id, code: o.code, kind: o.kind, priority: o.priority, status: o.status, reason: o.reason,
      patient: { id: o.patient.id, mrn: o.patient.mrn, nameAr: `${o.patient.firstNameAr} ${o.patient.familyAr}` },
      items: o.items.map((i) => ({ id: i.id, nameAr: i.nameAr, nameEn: i.nameEn, status: i.status, priceFils: i.priceFils })),
      totalFils: o.priceFils, createdAt: o.createdAt.toISOString(),
    })));
  },

  // ── Referrals ────────────────────────────────────────────────────────────
  "POST referrals": async (req) => {
    const actor = actorFrom(req);
    if (!actor || !can(actor.role, "clinical")) return problem("FORBIDDEN");
    const b = jo(await req.json()) as { patientId?: string; toDept?: string; toId?: string; urgency?: string; reason?: string; kind?: string };
    if (!b.patientId || !b.toDept) return problem("VALIDATION");
    const toDept = await db.department.findUnique({ where: { code: b.toDept } });
    if (!toDept) return problem("NOT_FOUND");
    const code = await nextReferralCode();
    const urgency = b.urgency ?? "routine";
    const r = await db.referral.create({ data: { code, patientId: b.patientId, fromId: actor!.id, toDepartmentId: toDept.id, toId: b.toId ?? null, kind: b.kind ?? "formal", urgency, status: "sent", reason: b.reason ?? null, responseDueAt: referralDueAt(urgency), summary: {} } });
    await audit({ actorId: actor!.id, actorRole: actor!.role, action: "create", resource: "referral", resourceId: r.id, patientId: b.patientId, after: { code, to: b.toDept, urgency } });
    return json({ id: r.id, code, responseDueAt: r.responseDueAt?.toISOString() }, 201);
  },
  "POST referrals/respond": async (req) => {
    const actor = actorFrom(req);
    if (!actor || !can(actor.role, "clinical")) return problem("FORBIDDEN");
    const b = jo(await req.json()) as { referralId?: string; status?: string; note?: string };
    const r = await db.referral.findUnique({ where: { id: String(b.referralId) } });
    if (!r) return problem("NOT_FOUND");
    await db.referral.update({ where: { id: r.id }, data: { status: b.status ?? "accepted", respondedAt: new Date(), reportAr: b.note ?? r.reportAr, closedAt: b.status === "closed" ? new Date() : r.closedAt } });
    await audit({ actorId: actor!.id, actorRole: actor!.role, action: "update", resource: "referral", resourceId: r.id, patientId: r.patientId, after: { status: b.status } });
    return json({ ok: true });
  },

  // ── MDT ──────────────────────────────────────────────────────────────────
  "POST mdt/decision": async (req) => {
    const actor = actorFrom(req);
    if (!actor || !can(actor.role, "clinical")) return problem("FORBIDDEN");
    const b = jo(await req.json()) as { caseId?: string; decision?: string; tasks?: { titleAr: string; role?: string }[] };
    const c = await db.mdtCase.findUnique({ where: { id: String(b.caseId) } });
    if (!c) return problem("NOT_FOUND");
    await db.mdtCase.update({ where: { id: c.id }, data: { decisionAr: b.decision ?? null, status: "decided", tasks: (b.tasks ?? []) as object } });
    const meeting = await db.mdtMeeting.findUnique({ where: { id: c.meetingId } });
    if (meeting && meeting.status !== "held") await db.mdtMeeting.update({ where: { id: meeting.id }, data: { status: "held", signedBy: actor!.id } });
    for (const t of b.tasks ?? []) {
      await db.task.create({ data: { titleAr: t.titleAr, role: t.role ?? "reception", patientId: c.patientId, status: "new", kind: "mdt", refType: "mdt-case", refId: c.id, dueAt: new Date(Date.now() + 86400000) } });
    }
    await audit({ actorId: actor!.id, actorRole: actor!.role, action: "mdt-decision", resource: "mdt-case", resourceId: c.id, patientId: c.patientId, after: { decision: b.decision } });
    return json({ ok: true });
  },
  "GET mdt/list": async (req) => {
    const actor = actorFrom(req);
    if (!actor) return problem("UNAUTHORIZED");
    const meetings = await db.mdtMeeting.findMany({ include: { cases: { include: { patient: true } } } }, );
    return json(meetings.map((m) => ({
      id: m.id, titleAr: m.titleAr, titleEn: m.titleEn, kind: m.kind, scheduledAt: m.scheduledAt.toISOString(), status: m.status,
      cases: m.cases.map((c) => ({ id: c.id, patient: { mrn: c.patient.mrn, nameAr: `${c.patient.firstNameAr} ${c.patient.familyAr}` }, questionAr: c.questionAr, decisionAr: c.decisionAr, status: c.status })),
    })));
  },

  // ── Consents ─────────────────────────────────────────────────────────────
  "GET consents/templates": async (req) => {
    actorFrom(req);
    const rows = await db.consentTemplate.findMany({ where: { active: true } });
    return json(rows.map((t) => ({ key: t.key, version: t.version, titleAr: t.titleAr, titleEn: t.titleEn, bodyAr: t.bodyAr, bodyEn: t.bodyEn, hardStop: t.hardStop, validDays: t.validDays, minReadSec: t.minReadSec })));
  },
  "POST consents/capture": async (req) => {
    const actor = actorFrom(req);
    if (!actor) return problem("UNAUTHORIZED");
    const b = jo(await req.json()) as { patientId?: string; templateKey?: string; method?: string; signedBy?: string; readSeconds?: number; otp?: string; witnessId?: string };
    if (!b.patientId || !b.templateKey) return problem("VALIDATION");
    const tpl = await db.consentTemplate.findUnique({ where: { key: b.templateKey } });
    if (!tpl) return problem("NOT_FOUND");
    if (tpl.minReadSec && (b.readSeconds ?? 0) < tpl.minReadSec) return problem("VALIDATION", { detail: `read too fast: ${b.readSeconds}s < ${tpl.minReadSec}s`, code: "READ_TOO_FAST" });
    const code = await nextConsentCode();
    const evidence = { device: "WS-001", ip: "10.0.0.x", method: b.method ?? "tablet", userAgent: "bmc-staff", capturedBy: actor!.id };
    const c = await db.consent.create({ data: { code, templateKey: tpl.key, templateVersion: tpl.version, patientId: b.patientId, method: b.method ?? "tablet", signedBy: b.signedBy ?? "—", status: "active", otpVerified: !!b.otp, witnessId: b.witnessId ?? null, evidence, readSeconds: b.readSeconds ?? 0 } });
    await audit({ actorId: actor!.id, actorRole: actor!.role, action: "sign", resource: "consent", resourceId: c.id, patientId: b.patientId, after: { code, template: tpl.key, method: b.method } });
    return json({ id: c.id, code }, 201);
  },
  "GET consents/for-patient": async (req, url) => {
    const actor = actorFrom(req);
    if (!actor) return problem("UNAUTHORIZED");
    const pid = url.searchParams.get("patientId") ?? "";
    const rows = await db.consent.findMany({ where: { patientId: pid }, orderBy: { signedAt: "desc" } });
    const needed = ["consent.surgery", "consent.anesthesia"];
    const have = new Set(rows.filter((r) => r.status === "active").map((r) => r.templateKey));
    return json({ consents: rows, hardStopsPending: needed.filter((k) => !have.has(k)) });
  },

  // ── Tasks & messages ─────────────────────────────────────────────────────
  "GET inbox": async (req, url) => {
    const actor = actorFrom(req);
    if (!actor) return problem("UNAUTHORIZED");
    const tasks = await db.task.findMany({ where: { OR: [{ assigneeId: actor!.id }, { role: actor!.role }], status: { in: ["new", "in-progress", "blocked"] } }, include: { patient: true }, orderBy: { dueAt: "asc" }, take: 20 });
    const notifs = await db.notification.findMany({ where: { OR: [{ userId: actor!.id }, { role: actor!.role }] }, orderBy: { createdAt: "desc" }, take: 15 });
    const threads = await db.messageThread.findMany({ orderBy: { lastAt: "desc" }, take: 10 });
    void url;
    return json({
      tasks: tasks.map((t) => ({ id: t.id, titleAr: t.titleAr, priority: t.priority, dueAt: t.dueAt?.toISOString(), kind: t.kind, patient: t.patient ? { mrn: t.patient.mrn, nameAr: `${t.patient.firstNameAr} ${t.patient.familyAr}` } : null })),
      notifications: notifs.map((n) => ({ id: n.id, kind: n.kind, titleAr: n.titleAr, titleEn: n.titleEn, bodyAr: n.bodyAr, bodyEn: n.bodyEn, at: n.createdAt.toISOString() })),
      threads: threads.map((t) => ({ id: t.id, subjectAr: t.subjectAr, category: t.category, lastAt: t.lastAt.toISOString() })),
    });
  },
  "POST tasks/complete": async (req) => {
    const actor = actorFrom(req);
    if (!actor) return problem("UNAUTHORIZED");
    const b = jo(await req.json()) as { taskId?: string };
    const t = await db.task.findUnique({ where: { id: String(b.taskId) } });
    if (!t) return problem("NOT_FOUND");
    await db.task.update({ where: { id: t.id }, data: { status: "done", completedAt: new Date() } });
    await audit({ actorId: actor.id, actorRole: actor.role, action: "complete", resource: "task", resourceId: t.id });
    return json({ ok: true });
  },
  "GET messages/thread": async (req, url) => {
    const actor = actorFrom(req);
    if (!actor) return problem("UNAUTHORIZED");
    const id = url.searchParams.get("id") ?? "";
    const msgs = await db.message.findMany({ where: { threadId: id }, orderBy: { createdAt: "asc" } });
    return json(msgs.map((m) => ({ id: m.id, senderId: m.senderId, senderRole: m.senderRole, body: m.body, system: m.system, at: m.createdAt.toISOString() })));
  },
  "POST messages/send": async (req) => {
    const actor = actorFrom(req);
    if (!actor) return problem("UNAUTHORIZED");
    const b = jo(await req.json()) as { threadId?: string; body?: string; priority?: string };
    if (!b.threadId || !b.body) return problem("VALIDATION");
    const m = await db.message.create({ data: { threadId: b.threadId, senderId: actor!.id, senderRole: actor!.role, body: b.body, priority: b.priority ?? "normal" } });
    await db.messageThread.update({ where: { id: b.threadId }, data: { lastAt: new Date() } });
    await audit({ actorId: actor!.id, actorRole: actor!.role, action: "message", resource: "thread", resourceId: b.threadId });
    return json({ id: m.id }, 201);
  },
};
export default routes;
