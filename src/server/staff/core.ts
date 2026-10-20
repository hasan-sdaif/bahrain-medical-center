/**
 * Staff core — reader adapter (simulated SDK), patient MPI (search/register/
 * merge), today's board, appointments, check-in, queue (§17.5).
 */
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { problem, ja, jo, actorFrom, type Actor } from "@/lib/api";
import { validateCpr, normalizeBhPhone, blindIndex, maskCpr, vatFor } from "@/lib/bahrain";
import { normalizeArabic, levenshtein, duplicateScore } from "@/lib/arabic";
import { nextMrn, nextApptCode, nextTicket, nextEncounterCode } from "@/lib/numbering";
import { CHECKIN_EARLY_MIN, CHECKIN_LATE_MIN, PRIORITY_WEIGHT } from "@/lib/types";
import { computeInvoiceMath, splitPayer, type Fils } from "@/lib/money";
import { can, type Module } from "../perm";
import type { RouteTable } from "../router";
import { json } from "../router";

function guard(actor: Actor | null, mod: string): Response | null {
  if (!actor) return problem("UNAUTHORIZED");
  if (!can(actor.role, mod as Module)) return problem("FORBIDDEN", { module: mod, role: actor.role });
  return null;
}

/** Simulated smart-card identities (Reader Agent — real SDK behind same adapter) */
const SIM_CARDS = [
  { cpr: "851022331", nameAr: ["يوسف", "جمال", "القاسم"], nameEn: "Yusuf Jamal Al-Qassim", dob: "1985-10-22", gender: "male", nat: "البحرين", gov: "capital", area: "السنابس", block: "325", phone: "+97339123001" },
  { cpr: "930214412", nameAr: ["هند", "خميس", "بوجسوم"], nameEn: "Hind Khamis Bujasoom", dob: "1993-02-14", gender: "female", nat: "البحرين", gov: "muharraq", area: "الدير", block: "211", phone: "+97339123002" },
  { cpr: "881231553", nameAr: ["محمود", "صادق", "أمير"], nameEn: "Mahmood Sadiq Ameer", dob: "1988-12-31", gender: "male", nat: "البحرين", gov: "southern", area: "المقشع", block: "714", phone: "+97339123003" },
  { cpr: "812030501", nameAr: ["أحمد", "إبراهيم", "الخالدي"], nameEn: "Ahmed Al-Khalidi", dob: "1984-03-05", gender: "male", nat: "البحرين", gov: "capital", area: "الحورة", block: "318", phone: "+97339112233" },
];

const routes: RouteTable = {
  // ── Reader (Identity Reader Adapter — simulator fills real SDK slot) ─────
  "GET reader/status": async (req) => {
    const actor = actorFrom(req);
    const deny = guard(actor, "reader"); if (deny) return deny;
    return json({ online: true, agent: "SCardReadServer 1.0.0-sim", card: "ready", workstations: [{ id: "WS-001", name: "استقبال 1", status: "online" }] });
  },
  "POST reader/read": async (req) => {
    const actor = actorFrom(req);
    const deny = guard(actor, "reader"); if (deny) return deny;
    const body = jo(await req.json()) as { cardIndex?: number; cpr?: string };
    const card = SIM_CARDS[(body.cardIndex ?? Math.floor(Math.random() * SIM_CARDS.length)) % SIM_CARDS.length];
    const v = validateCpr(card.cpr);
    if (!v.ok) return problem("ID_INVALID_CPR");
    // deterministic duplicate detection (blind index)
    const bi = blindIndex("CPR", card.cpr, "BH");
    const existing = await db.patientIdentifier.findUnique({ where: { blindIndex: bi }, include: { patient: true } });
    const record = {
      idType: "CPR", idNumber: card.cpr, issuingCountry: "BH",
      fullNameAr: `${card.nameAr[0]} ${card.nameAr[1]} ${card.nameAr[2]}`, fullNameEn: card.nameEn,
      namePartsAr: { first: card.nameAr[0], father: card.nameAr[1], family: card.nameAr[2] },
      dob: card.dob, gender: card.gender, nationality: card.nat,
      address: { governorate: card.gov, area: card.area, block: card.block },
      phone: card.phone, authenticity: "verified" as const, readAt: new Date().toISOString(),
      readerDeviceId: "RD-SIM-001", workstationId: "WS-001", agentVersion: "1.0.0-sim",
      fieldSources: { cpr: "chip", nameAr: "chip", nameEn: "chip", dob: "chip", address: "chip", phone: "chip" },
    };
    await audit({ actorId: actor!.id, actorRole: actor!.role, action: "reader-read", resource: "reader-session", patientId: existing?.patientId ?? null, after: { cpr: maskCpr(card.cpr), result: existing ? "existing" : "new" } });
    return json({ existing: existing ? { id: existing.patient.id, mrn: existing.patient.mrn, nameAr: `${existing.patient.firstNameAr} ${existing.patient.familyAr}`, assurance: existing.patient.assurance } : null, record });
  },

  // ── Patient search (unified, normalized, fuzzy, masked, logged) ──────────
  "GET patients/search": async (req, url) => {
    const actor = actorFrom(req);
    const deny = guard(actor, actor && ["reception", "callcenter"].includes(actor.role) ? "board" : "clinical"); if (deny) return deny;
    const q = (url.searchParams.get("query") ?? "").trim();
    if (!q) return json({ exact: [], similar: [] });
    const digits = q.replace(/\D/g, "");
    // 1) exact: blind index on 9-digit CPR-like
    const exact: { id: string; mrn: string; nameAr: string; nameEn: string | null; dob: string; phone: string | null; assurance: number; idMasked: string }[] = [];
    const similar: { id: string; mrn: string; nameAr: string; dob: string; score: number; idMasked: string }[] = [];
    if (digits.length >= 8) {
      const bi = blindIndex("CPR", digits.length === 9 ? digits : digits.slice(-9), "BH");
      const hit = await db.patientIdentifier.findUnique({ where: { blindIndex: bi }, include: { patient: true } });
      if (hit) exact.push({ id: hit.patient.id, mrn: hit.patient.mrn, nameAr: `${hit.patient.firstNameAr} ${hit.patient.familyAr}`, nameEn: `${hit.patient.firstNameEn ?? ""} ${hit.patient.familyEn ?? ""}`.trim(), dob: hit.patient.dob.toISOString(), phone: hit.patient.phone, assurance: hit.patient.assurance, idMasked: maskCpr(hit.number) });
      const byMrn = digits.startsWith("p26") ? await db.patient.findUnique({ where: { mrn: q.toUpperCase() } }) : null;
      if (byMrn) exact.push({ id: byMrn.id, mrn: byMrn.mrn, nameAr: `${byMrn.firstNameAr} ${byMrn.familyAr}`, nameEn: `${byMrn.firstNameEn ?? ""} ${byMrn.familyEn ?? ""}`.trim(), dob: byMrn.dob.toISOString(), phone: byMrn.phone, assurance: byMrn.assurance, idMasked: "" });
    }
    // phone
    if (!exact.length && /^\+?\d[\d\s]{7,}$/.test(q)) {
      const tel = normalizeBhPhone(q);
      if (tel.ok) {
        const hits = await db.patient.findMany({ where: { phone: tel.e164 }, take: 3 });
        for (const p of hits) exact.push({ id: p.id, mrn: p.mrn, nameAr: `${p.firstNameAr} ${p.familyAr}`, nameEn: `${p.firstNameEn ?? ""} ${p.familyEn ?? ""}`.trim(), dob: p.dob.toISOString(), phone: p.phone, assurance: p.assurance, idMasked: "" });
      }
    }
    // fuzzy names when no exact
    if (!exact.length) {
      const nq = normalizeArabic(q);
      const all = await db.patient.findMany({ take: 400, include: { identifiers: true } });
      for (const p of all) {
        const full = normalizeArabic(`${p.firstNameAr} ${p.familyAr}`);
        const d = levenshtein(nq, full, 3);
        const motherHit = p.motherNameAr && nq.length > 3 && normalizeArabic(p.motherNameAr).includes(nq);
        if (d <= 2 || full.includes(nq) || motherHit) {
          const score = duplicateScore({ nameAr: q, dob: new Date(), phone: "", gender: "male", motherName: q }, { nameAr: `${p.firstNameAr} ${p.familyAr}`, dob: p.dob, phone: p.phone, gender: p.gender, motherName: p.motherNameAr ?? "" });
          similar.push({ id: p.id, mrn: p.mrn, nameAr: `${p.firstNameAr} ${p.familyAr}`, dob: p.dob.toISOString(), score: Math.max(score, d === 0 ? 85 : 60), idMasked: p.identifiers[0] ? maskCpr(p.identifiers[0].number) : "" });
        }
      }
      similar.sort((a, b) => b.score - a.score);
    }
    await audit({ actorId: actor!.id, actorRole: actor!.role, action: "patient-search", resource: "patient", reason: q.slice(0, 40), after: { exact: exact.length, similar: similar.length } });
    return json({ exact: exact.slice(0, 5), similar: similar.slice(0, 5) });
  },

  // ── Register (hard duplicate gate) ────────────────────────────────────────
  "POST patients/register": async (req) => {
    const actor = actorFrom(req);
    const deny = guard(actor, actor && ["reception", "callcenter"].includes(actor.role) ? "board" : "clinical"); if (deny) return deny;
    const b = jo(await req.json()) as Record<string, unknown>;
    const firstAr = String(b.firstAr ?? "").trim(); const familyAr = String(b.familyAr ?? "").trim();
    const dob = new Date(String(b.dob ?? "2000-01-01"));
    const gender = b.gender === "female" ? "female" : "male";
    const phone = String(b.phone ?? "");
    const tel = normalizeBhPhone(phone);
    if (!tel.ok) return problem("PHONE_INVALID_BH");
    if (!firstAr || !familyAr) return problem("VALIDATION", { detail: "name required" });
    // deterministic dup via identifiers
    let idBi: string | null = null;
    if (typeof b.cpr === "string" && b.cpr) {
      const v = validateCpr(b.cpr);
      if (!v.ok) return problem(v.code);
      idBi = blindIndex("CPR", v.cpr, "BH");
    } else if (typeof b.gccCountry === "string" && typeof b.gccNumber === "string") {
      idBi = blindIndex("GCC_ID", b.gccNumber.replace(/\s/g, ""), b.gccCountry);
    } else if (typeof b.passportCountry === "string" && typeof b.passportNumber === "string") {
      idBi = blindIndex("PASSPORT", String(b.passportNumber).toUpperCase(), b.passportCountry);
    }
    if (idBi) {
      const dup = await db.patientIdentifier.findUnique({ where: { blindIndex: idBi } });
      if (dup) return problem("ID_DUPLICATE", { existingMrn: (await db.patient.findUnique({ where: { id: dup.patientId } }))?.mrn });
    }
    // probabilistic dup warning
    const candidates: { id: string; mrn: string; nameAr: string; score: number }[] = [];
    const probe = { nameAr: `${firstAr} ${familyAr}`, dob, phone: tel.e164, gender, motherName: String(b.motherAr ?? "") };
    const all = await db.patient.findMany({ take: 400 });
    for (const p of all) {
      const s = duplicateScore(probe, { nameAr: `${p.firstNameAr} ${p.familyAr}`, dob: p.dob, phone: p.phone ?? "", gender: p.gender, motherName: p.motherNameAr ?? "" });
      if (s >= 70) candidates.push({ id: p.id, mrn: p.mrn, nameAr: `${p.firstNameAr} ${p.familyAr}`, score: s });
    }
    const mrn = await nextMrn();
    const patient = await db.patient.create({
      data: {
        mrn, assurance: (b.assurance as number) ?? 3,
        firstNameAr: firstAr, fatherAr: String(b.fatherAr ?? ""), familyAr,
        firstNameEn: String(b.firstEn ?? firstAr), familyEn: String(b.familyEn ?? familyAr),
        latinName: String(b.latinName ?? `${firstAr} ${familyAr}`),
        normalizedKey: normalizeArabic(`${firstAr} ${familyAr}`),
        dob, gender, nationality: String(b.nationality ?? "البحرين"), motherNameAr: String(b.motherAr ?? "") || null,
        phone: tel.e164, preferredLang: b.lang === "en" ? "en" : "ar",
        address: (b.address ?? {}) as object, emergency: (b.emergency ?? {}) as object,
        createdBy: actor!.id,
      },
    });
    if (idBi) {
      const type = b.cpr ? "CPR" : b.gccCountry ? "GCC_ID" : "PASSPORT";
      await db.patientIdentifier.create({ data: { patientId: patient.id, type, number: String(b.cpr ?? b.gccNumber ?? b.passportNumber ?? ""), country: String(b.cpr ? "BH" : b.gccCountry ?? b.passportCountry ?? ""), source: b.source === "chip" ? "chip" : "manual", blindIndex: idBi } });
    }
    if (b.payerId) {
      await db.insurancePolicy.create({ data: { patientId: patient.id, payerId: String(b.payerId), membershipNo: String(b.membershipNo ?? "N/A"), copayFils: Number(b.copayFils ?? 0), coinsPct: Number(b.coinsPct ?? 0), validUntil: b.policyValidUntil ? new Date(String(b.policyValidUntil)) : null } });
    }
    await audit({ actorId: actor!.id, actorRole: actor!.role, action: "create", resource: "patient", resourceId: patient.id, patientId: patient.id, after: { mrn } });
    return json({ id: patient.id, mrn, nameAr: `${firstAr} ${familyAr}`, duplicateWarnings: candidates }, 201);
  },

  // ── Full chart (EMR root) ────────────────────────────────────────────────
  "GET patients/chart/*": async (req, url) => {
    const actor = actorFrom(req);
    if (!actor) return problem("UNAUTHORIZED");
    const id = url.pathname.split("/").pop() ?? "";
    const p = await db.patient.findUnique({ where: { id }, include: { identifiers: true, flags: true, policies: { include: { payer: true } } } });
    if (!p) return problem("NOT_FOUND");
    const clinicalOk = can(actor.role, "clinical");
    const [problems, allergies, meds, imms, growth, encounters, vitals] = await Promise.all([
      db.problem.findMany({ where: { patientId: id, status: "active" } }),
      db.allergy.findMany({ where: { patientId: id } }),
      db.medicationStatement.findMany({ where: { patientId: id, status: "active" } }),
      db.immunization.findMany({ where: { patientId: id }, orderBy: { givenAt: "desc" }, take: 10 }),
      db.growthRecord.findMany({ where: { patientId: id }, orderBy: { recordedAt: "asc" } }),
      clinicalOk ? db.encounter.findMany({ where: { patientId: id }, orderBy: { startedAt: "desc" }, take: 10 }) : Promise.resolve([]),
      db.vitals.findMany({ where: { patientId: id }, orderBy: { recordedAt: "desc" }, take: 5 }),
    ]);
    await audit({ actorId: actor.id, actorRole: actor.role, action: "view-chart", resource: "patient", resourceId: id, patientId: id, reason: actor.role === "reception" ? "registration/admin" : "care" });
    return json({
      banner: {
        id: p.id, mrn: p.mrn, nameAr: `${p.firstNameAr} ${p.familyAr}`, nameEn: `${p.firstNameEn ?? ""} ${p.familyEn ?? ""}`.trim(),
        age: Math.floor((Date.now() - p.dob.getTime()) / 3.15576e10), dob: p.dob.toISOString(), gender: p.gender,
        assurance: p.assurance, phone: p.phone, bloodType: p.bloodType,
        idMasked: p.identifiers[0] ? maskCpr(p.identifiers[0].number) : "",
        address: p.address, flags: p.flags, insurance: p.policies[0] ? { payerAr: p.policies[0].payer.nameAr, membershipNo: p.policies[0].membershipNo, copayFils: p.policies[0].copayFils, coinsPct: p.policies[0].coinsPct } : null,
        restricted: p.flags.some((f) => f.kind === "restricted"),
      },
      clinical: clinicalOk ? { problems, allergies, meds, imms, growth, encounters, vitals } : null,
      adminOnly: !clinicalOk ? { problems: problems.length, encounters: encounters.length, noteAr: "العرض السريري يتطلب صلاحية علاجية — الاستقبال يرى البيانات الإدارية فقط" } : null,
    });
  },

  // ── Merge (special permission: med-director / sysadmin) ──────────────────
  "POST patients/merge": async (req) => {
    const actor = actorFrom(req);
    if (!actor || !["med-director", "sysadmin", "dpo"].includes(actor.role)) return problem("FORBIDDEN");
    const b = jo(await req.json()) as { primaryId?: string; secondaryId?: string };
    const primary = await db.patient.findUnique({ where: { id: String(b.primaryId) } });
    const secondary = await db.patient.findUnique({ where: { id: String(b.secondaryId) } });
    if (!primary || !secondary) return problem("NOT_FOUND");
    // move identifiers & flags to primary; mark secondary as merged-ref via notes
    await db.patientIdentifier.updateMany({ where: { patientId: secondary.id }, data: { patientId: primary.id } });
    await db.patientFlag.updateMany({ where: { patientId: secondary.id }, data: { patientId: primary.id } });
    await db.patient.update({ where: { id: secondary.id }, data: { notesAr: `مدموج في ${primary.mrn} بتاريخ ${new Date().toISOString()}`, deceased: true } });
    await audit({ actorId: actor.id, actorRole: actor.role, action: "merge", resource: "patient", resourceId: primary.id, patientId: primary.id, before: { secondaryMrn: secondary.mrn }, after: { primaryMrn: primary.mrn }, reason: "duplicate-merge" });
    return json({ ok: true, primaryMrn: primary.mrn, mergedMrn: secondary.mrn, unmergeWindowDays: 30 });
  },

  // ── Today board ───────────────────────────────────────────────────────────
  "GET board": async (req, url) => {
    const actor = actorFrom(req);
    const deny = guard(actor, "board"); if (deny) return deny;
    const deptCode = url.searchParams.get("dept");
    const deptRow = deptCode ? await db.department.findUnique({ where: { code: deptCode } }) : null;
    const start = new Date(); start.setUTCHours(0, 0, 0, 0);
    const end = new Date(start.getTime() + 86400000);
    const appts = await db.appointment.findMany({
      where: deptRow ? { departmentId: deptRow.id, start: { gte: start, lt: end } } : { start: { gte: start, lt: end } },
      include: { patient: true, employee: true, appointmentType: true, department: true },
      orderBy: { start: "asc" },
    });
    await audit({ actorId: actor!.id, actorRole: actor!.role, action: "view-board", resource: "appointment" });
    return json(appts.map((a) => ({
      id: a.id, code: a.code, start: a.start.toISOString(), end: a.end.toISOString(), status: a.status, channel: a.channel,
      patient: { id: a.patient.id, mrn: a.patient.mrn, nameAr: `${a.patient.firstNameAr} ${a.patient.familyAr}`, nameEn: `${a.patient.firstNameEn ?? ""} ${a.patient.familyEn ?? ""}`.trim(), phone: a.patient.phone, assurance: a.patient.assurance },
      doctor: a.employee ? { id: a.employee.id, nameAr: a.employee.nameAr, nameEn: a.employee.nameEn } : null,
      dept: { code: a.department.code, nameAr: a.department.nameAr, nameEn: a.department.nameEn, color: a.department.color },
      type: { code: a.appointmentType.code, nameAr: a.appointmentType.nameAr, nameEn: a.appointmentType.nameEn },
      paymentStatus: a.paymentStatus, priceFils: a.priceFils,
    })));
  },

  // ── Book (staff channels) with conflict guard (§17.4) ────────────────────
  "POST appointments/book": async (req) => {
    const actor = actorFrom(req);
    const deny = guard(actor, "appointments"); if (deny) return deny;
    const b = jo(await req.json()) as Record<string, unknown>;
    const patientId = String(b.patientId ?? "");
    const start = new Date(String(b.start ?? ""));
    const typeCode = String(b.typeCode ?? "GP-NEW");
    const typeRow = await db.appointmentType.findFirst({ where: { code: typeCode } });
    if (!typeRow || !patientId || Number.isNaN(start.getTime())) return problem("VALIDATION");
    const end = new Date(start.getTime() + typeRow.durationMin * 60000);
    // conflicts
    const patientConflict = await db.appointment.findFirst({ where: { patientId, status: { in: ["requested", "confirmed", "arrived"] }, start: { lt: end }, end: { gt: start } } });
    if (patientConflict) return problem("PATIENT_DOUBLE_BOOKED", { at: patientConflict.start.toISOString() });
    let employeeId: string | null = (b.employeeId as string) ?? null;
    if (!employeeId) {
      const doc = await db.employee.findFirst({ where: { departmentId: typeRow.departmentId ?? undefined, isDoctor: true, active: true } });
      employeeId = doc?.id ?? null;
    }
    const docConflict = employeeId ? await db.appointment.findFirst({ where: { employeeId, status: { in: ["requested", "confirmed", "arrived", "in-service"] }, start: { lt: end }, end: { gt: start } } }) : null;
    if (docConflict) return problem("SLOT_TAKEN", { at: docConflict.start.toISOString() });
    const dept = typeRow.departmentId ?? (await db.department.findFirst())!.id;
    const code = await nextApptCode();
    const appt = await db.appointment.create({
      data: { code, patientId, departmentId: dept, employeeId, appointmentTypeId: typeRow.id, start, end, status: "confirmed", channel: (b.channel as string) ?? "reception", priceFils: typeRow.priceFils, createdBy: actor!.id },
    });
    await audit({ actorId: actor!.id, actorRole: actor!.role, action: "create", resource: "appointment", resourceId: appt.id, patientId, after: { code, start: start.toISOString(), type: typeCode } });
    return json({ id: appt.id, code, barcode: `BMC-APPT-${appt.id.slice(-8).toUpperCase()}` }, 201);
  },

  // ── Check-in (barcode | cpr | manual) → arrived + queue ticket ───────────
  "POST checkin": async (req) => {
    const actor = actorFrom(req);
    const deny = guard(actor, "queue"); if (deny) return deny;
    const b = jo(await req.json()) as { appointmentId?: string; barcode?: string; cpr?: string; patientId?: string; priority?: string };
    let appt = null as { id: string; patientId: string; departmentId: string; start: Date; appointmentTypeId: string } | null;
    if (b.appointmentId) appt = await db.appointment.findUnique({ where: { id: b.appointmentId } });
    else if (b.cpr) {
      const bi = blindIndex("CPR", b.cpr.replace(/\D/g, "").slice(-9), "BH");
      const pid = (await db.patientIdentifier.findUnique({ where: { blindIndex: bi } }))?.patientId;
      if (pid) appt = await db.appointment.findFirst({ where: { patientId: pid, start: { gte: new Date(Date.now() - 6 * 3600000) }, status: { in: ["requested", "confirmed"] } }, orderBy: { start: "asc" } });
    } else if (b.barcode?.startsWith("BMC-APPT-")) {
      appt = await db.appointment.findUnique({ where: { id: b.barcode.replace("BMC-APPT-", "").toLowerCase() } });
    }
    if (!appt) return problem("NOT_FOUND", { detail: "no upcoming appointment" });
    // early/late policy
    const diffMin = Math.round((Date.now() - appt.start.getTime()) / 60000);
    if (diffMin < -CHECKIN_EARLY_MIN) return problem("STATE_INVALID", { detail: `early: ${-diffMin}min before` , code: "TOO_EARLY" }, 409);
    if (diffMin > CHECKIN_LATE_MIN + 15) return problem("STATE_INVALID", { detail: "late — reschedule or walk-in low priority", code: "TOO_LATE" }, 409);
    await db.appointment.update({ where: { id: appt.id }, data: { status: "arrived", checkinAt: new Date(), checkinMethod: b.barcode ? "barcode" : b.cpr ? "cpr" : "manual" } });
    // encounter create if none
    let enc = await db.encounter.findFirst({ where: { appointmentId: appt.id } });
    if (!enc) {
      const code = await nextEncounterCode();
      enc = await db.encounter.create({ data: { code, patientId: appt.patientId, departmentId: appt.departmentId, appointmentId: appt.id, status: "arrived", type: "consultation", startedAt: new Date() } });
    }
    // ticket at clinic point (letter C) — priority mapping
    const priority = b.priority ?? "normal";
    const code = await nextTicket("C");
    const ticket = await db.queueTicket.create({ data: { code, patientId: appt.patientId, appointmentId: appt.id, servicePointId: (await db.servicePoint.findFirst({ where: { code: "C" } }))!.id, priority, status: "waiting", source: b.barcode ? "kiosk" : "reception", waitedMin: 0 } });
    await audit({ actorId: actor!.id, actorRole: actor!.role, action: "checkin", resource: "appointment", resourceId: appt.id, patientId: appt.patientId, after: { method: b.barcode ? "barcode" : b.cpr ? "cpr" : "manual", ticket: ticket.code } });
    return json({ appointment: { id: appt.id, status: "arrived" }, encounter: { id: enc.id, code: enc.code }, ticket: { code: ticket.code, priority } }, 201);
  },

  // ── Queue: list + call-next (§17.5) ──────────────────────────────────────
  "GET queue/list": async (req, url) => {
    const actor = actorFrom(req);
    const deny = guard(actor, "queue"); if (deny) return deny;
    const letter = url.searchParams.get("point") ?? "C";
    const spRow = await db.servicePoint.findFirst({ where: { code: letter } });
    if (!spRow) return problem("NOT_FOUND");
    const tickets = await db.queueTicket.findMany({ where: { servicePointId: spRow.id, status: { in: ["waiting", "called", "serving"] } }, include: { patient: true }, orderBy: { issuedAt: "asc" } });
    const mapped = tickets.map((t) => ({
      id: t.id, code: t.code, status: t.status, priority: t.priority, waitedMin: Math.max(t.waitedMin, Math.round((Date.now() - t.issuedAt.getTime()) / 60000)), callCount: t.callCount,
      patient: { id: t.patient.id, mrn: t.patient.mrn, nameAr: `${t.patient.firstNameAr} ${t.patient.familyAr}`, nameEn: `${t.patient.firstNameEn ?? ""} ${t.patient.familyEn ?? ""}`.trim() },
      weight: (PRIORITY_WEIGHT[t.priority] ?? 0) + Math.min(Math.floor(Math.max(t.waitedMin, Math.round((Date.now() - t.issuedAt.getTime()) / 60000)) / 10), 5),
    }));
    mapped.sort((a, b) => b.weight - a.weight || b.waitedMin - a.waitedMin);
    return json(mapped);
  },
  "POST queue/call-next": async (req) => {
    const actor = actorFrom(req);
    const deny = guard(actor, "queue"); if (deny) return deny;
    const b = jo(await req.json()) as { point?: string; room?: string };
    const letter = b.point ?? "C";
    const spRow = await db.servicePoint.findFirst({ where: { code: letter } });
    if (!spRow) return problem("NOT_FOUND");
    const waiting = await db.queueTicket.findMany({ where: { servicePointId: spRow.id, status: { in: ["waiting", "called"] } } });
    if (!waiting.length) return json({ called: null });
    waiting.sort((a, b) => {
      const wa = (PRIORITY_WEIGHT[a.priority] ?? 0) + Math.min(Math.floor(Math.max(a.waitedMin, Math.round((Date.now() - a.issuedAt.getTime()) / 60000)) / 10), 5);
      const wb = (PRIORITY_WEIGHT[b.priority] ?? 0) + Math.min(Math.floor(Math.max(b.waitedMin, Math.round((Date.now() - b.issuedAt.getTime()) / 60000)) / 10), 5);
      if (wa !== wb) return wb - wa;
      return b.issuedAt.getTime() - a.issuedAt.getTime();
    });
    const next = waiting[0];
    const room = b.room ?? "٣";
    await db.queueTicket.update({ where: { id: next.id }, data: { status: "called", calledAt: new Date(), callCount: { increment: 1 }, roomLabel: room } });
    const pat = await db.patient.findUnique({ where: { id: next.patientId } });
    await audit({ actorId: actor!.id, actorRole: actor!.role, action: "queue-call", resource: "queue-ticket", resourceId: next.id, patientId: next.patientId, after: { code: next.code, room } });
    // realtime broadcast to display + staff rooms
    try {
      await fetch("http://localhost:3003/emit", { method: "POST", headers: { "content-type": "application/json", "x-bmc-internal": process.env.BMC_INTERNAL_KEY ?? "bmc-dev-internal" }, body: JSON.stringify({ event: "queue:called", room: "display", payload: { point: spRow.nameAr, code: next.code, room, patientName: pat ? `${pat.firstNameAr} ${pat.familyAr}` : "" } }) });
    } catch { /* realtime optional */ }
    return json({ called: { id: next.id, code: next.code, room, patient: pat ? { nameAr: `${pat.firstNameAr} ${pat.familyAr}`, mrn: pat.mrn } : null, priority: next.priority } });
  },
  "POST queue/serve": async (req) => {
    const actor = actorFrom(req);
    const deny = guard(actor, "queue"); if (deny) return deny;
    const b = jo(await req.json()) as { ticketId?: string; action?: string };
    if (!b.ticketId) return problem("VALIDATION");
    const t = await db.queueTicket.findUnique({ where: { id: b.ticketId } });
    if (!t) return problem("NOT_FOUND");
    const status = b.action === "done" ? "done" : b.action === "no-show" ? "no-show" : "serving";
    await db.queueTicket.update({ where: { id: t.id }, data: { status, servedAt: status === "serving" ? new Date() : t.servedAt, doneAt: status === "done" ? new Date() : t.doneAt } });
    await audit({ actorId: actor!.id, actorRole: actor!.role, action: `queue-${b.action}`, resource: "queue-ticket", resourceId: t.id, patientId: t.patientId });
    return json({ ok: true, status });
  },

  // ── available slots (shared with public) ─────────────────────────────────
  "GET appointments/slots": async (req, url) => {
    const actor = actorFrom(req);
    if (!actor) return problem("UNAUTHORIZED");
    const deptCode = url.searchParams.get("dept") ?? "GP";
    const docId = url.searchParams.get("doctor");
    const dayOffset = Number(url.searchParams.get("day") ?? 0);
    const base = new Date(); base.setUTCHours(0, 0, 0, 0);
    const dayStart = new Date(base.getTime() + dayOffset * 86400000 + 3 * 3600000); // BH 00:00 → UTC
    const dayEnd = new Date(dayStart.getTime() + 86400000);
    const deptRow = await db.department.findUnique({ where: { code: deptCode } });
    if (!deptRow) return problem("NOT_FOUND");
    const doctors = await db.employee.findMany({ where: { departmentId: deptRow.id, isDoctor: true, active: true, ...(docId ? { id: docId } : {}) } });
    const booked = await db.appointment.findMany({ where: { start: { gte: dayStart, lt: dayEnd }, status: { in: ["requested", "confirmed", "arrived", "in-service"] } }, select: { employeeId: true, start: true, end: true } });
    const slots: { doctorId: string; doctorNameAr: string; at: string; typeCode: string; typeAr: string; typeEn: string; priceFils: number }[] = [];
    for (const doc of doctors) {
      for (let m = 9 * 60; m <= 19 * 60 - 30; m += 30) {
        if (m >= 13 * 60 && m < 16 * 60) continue; // prayer/lunch
        const at = new Date(dayStart.getTime() + m * 60000);
        if (at < new Date(Date.now() + 3600000)) continue;
        const end = new Date(at.getTime() + 30 * 60000);
        const taken = booked.some((b) => b.employeeId === doc.id && b.start < end && b.end > at);
        if (!taken) {
          slots.push({ doctorId: doc.id, doctorNameAr: doc.nameAr, at: at.toISOString(), typeCode: "GP-NEW", typeAr: "استشارة", typeEn: "Consult", priceFils: 15000 });
        }
      }
    }
    return json({ date: dayStart.toISOString().slice(0, 10), slots: slots.slice(0, 40) });
  },
};

export default routes;
