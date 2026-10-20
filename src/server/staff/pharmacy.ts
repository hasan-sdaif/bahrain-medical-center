/**
 * Staff pharmacy — prescription safety (§17.7), weight dosing (§17.8),
 * dispensing with FEFO batch selection, recall via batches (§17.15).
 */
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { problem, ja, jo, actorFrom } from "@/lib/api";
import { nextRxCode } from "@/lib/numbering";
import { checkPrescriptionSafety, weightBasedDose, type RxSafetyReport } from "@/lib/algorithms";
import { can } from "../perm";
import type { RouteTable } from "../router";
import { json } from "../router";

const routes: RouteTable = {
  "GET pharmacy/queue": async (req) => {
    const actor = actorFrom(req);
    if (!actor || !can(actor.role, "pharmacy")) return problem("FORBIDDEN");
    const rxs = await db.prescription.findMany({ where: { status: { in: ["signed", "pharmacy-review", "preparing"] } }, include: { items: { include: { drug: true } }, patient: true, doctor: true }, orderBy: { createdAt: "desc" } });
    return json(rxs.map((r) => ({
      id: r.id, code: r.code, status: r.status, createdAt: r.createdAt.toISOString(),
      patient: { mrn: r.patient.mrn, nameAr: `${r.patient.firstNameAr} ${r.patient.familyAr}`, dob: r.patient.dob.toISOString(), gender: r.patient.gender, weightHint: null },
      doctor: r.doctor ? { nameAr: r.doctor.nameAr } : null,
      items: r.items.map((i) => ({
        id: i.id, drug: { code: i.drug.code, nameAr: i.drug.nameAr, nameEn: i.drug.nameEn, form: i.drug.form, strength: i.drug.strength, highAlert: i.drug.highAlert, lookAlike: i.drug.lookAlike, controlled: i.drug.controlled },
        doseAr: i.doseAr, frequency: i.frequency, durationDays: i.durationDays, qty: i.qty, instrAr: i.instrAr, instrEn: i.instrEn,
      })),
      safety: jo(r.safety),
    })));
  },
  // Doctor creates prescription with mandatory safety checks
  "POST prescriptions": async (req) => {
    const actor = actorFrom(req);
    if (!actor || !can(actor.role, "pharmacy")) return problem("FORBIDDEN");
    const b = jo(await req.json()) as { patientId?: string; encounterId?: string; items?: { drugCode?: string; doseMg?: number; doseAr?: string; doseEn?: string; route?: string; frequency?: string; durationDays?: number; qty?: number; refills?: number; instrAr?: string; instrEn?: string }[]; overrideReason?: string };
    if (!b.patientId || !b.items?.length) return problem("VALIDATION");
    const patient = await db.patient.findUnique({ where: { id: b.patientId }, include: { allergies: true } });
    if (!patient) return problem("NOT_FOUND");
    const flags = await db.patientFlag.findMany({ where: { patientId: patient.id } });
    const pregnant = flags.some((f) => f.kind === "pregnant");
    const age = Math.floor((Date.now() - patient.dob.getTime()) / 3.15576e10);
    const weightKg = age < 16 ? 30 : 70; // demo weight; Peds uses growth records
    const medStatements = await db.medicationStatement.findMany({ where: { patientId: patient.id, status: "active" } });
    const allErrors: RxSafetyReport["errors"] = [];
    const allWarnings: RxSafetyReport["warnings"] = [];
    const doseHelpers: { drugCode: string; dailyMg?: number; perDoseMg?: number; volumeMl?: number | null }[] = [];
    for (const it of b.items) {
      const drug = await db.drug.findUnique({ where: { code: String(it.drugCode) } });
      if (!drug) { allErrors.push({ code: "DRUG_NOT_FOUND", ar: `دواء غير موجود: ${it.drugCode}`, en: `Unknown drug: ${it.drugCode}` }); continue; }
      const doseMg = (it.doseMg ?? Number(((it.doseAr ?? "0").replace(/[^\d.]/g, "")))) || 0;
      const report = checkPrescriptionSafety({
        drug: { nameEn: drug.nameEn, allergyTags: ja(drug.allergyTags) as string[], interactTags: ja(drug.interactTags) as string[], maxDailyMg: drug.maxDailyMg, adultMaxDoseMg: null, pregCategory: drug.pregCategory, controlled: drug.controlled, highAlert: drug.highAlert, lookAlike: drug.lookAlike },
        doseMg,
        patient: { ageYears: age, weightKg, pregnant, allergies: patient.allergies.map((a) => ({ substance: a.substance })), activeMedications: medStatements.map((m) => ({ nameEn: m.nameEn, interactTags: [] })), renalImpaired: false },
      });
      allErrors.push(...report.errors);
      allWarnings.push(...report.warnings);
      if (drug.mgPerKg && age < 12) {
        const w = weightBasedDose(drug.mgPerKg, weightKg, 3, { absoluteMaxMg: drug.maxDailyMg });
        doseHelpers.push({ drugCode: drug.code, dailyMg: w.dailyMg, perDoseMg: w.perDoseMg, volumeMl: w.volumeMl });
      }
    }
    const blocking = allErrors.length > 0 && !b.overrideReason;
    const code = await nextRxCode();
    const rx = await db.prescription.create({
      data: {
        code, patientId: patient.id, encounterId: b.encounterId ?? null, doctorId: actor!.id,
        status: blocking ? "draft" : "signed", signedAt: blocking ? null : new Date(),
        safety: { errors: allErrors, warnings: allWarnings, doseHelpers }, overrideReason: b.overrideReason ?? null,
        items: {
          create: (b.items ?? []).map((i) => ({
            drugId: (i.drugCode ?? ""), doseAr: i.doseAr ?? "", doseEn: i.doseEn ?? i.doseAr ?? "",
            route: i.route ?? "oral", frequency: i.frequency ?? "يومياً", durationDays: i.durationDays ?? 5, qty: i.qty ?? 1, refills: i.refills ?? 0,
            instrAr: i.instrAr ?? null, instrEn: i.instrEn ?? null,
          })),
        },
      },
    });
    await audit({ actorId: actor!.id, actorRole: actor!.role, action: blocking ? "draft-blocked" : "sign", resource: "prescription", resourceId: rx.id, patientId: patient.id, after: { code, errors: allErrors.length, warnings: allWarnings.length, override: b.overrideReason ?? null } });
    return json({ id: rx.id, code, blocked: blocking, errors: allErrors, warnings: allWarnings, doseHelpers }, 201);
  },
  // Pharmacist dispenses with FEFO
  "POST pharmacy/dispense": async (req) => {
    const actor = actorFrom(req);
    if (!actor || !can(actor.role, "pharmacy")) return problem("FORBIDDEN");
    const b = jo(await req.json()) as { prescriptionItemId?: string; counseled?: boolean; paymentStatus?: string };
    const item = await db.prescriptionItem.findUnique({ where: { id: String(b.prescriptionItemId) }, include: { drug: true, prescription: true } });
    if (!item) return problem("NOT_FOUND");
    // FEFO: earliest expiry batch with qty>0
    const batches = await db.batch.findMany({ where: { ownerType: "drug", ownerId: item.drugId, qty: { gt: 0 }, status: "ok" }, orderBy: { expiry: "asc" } });
    const batch = batches[0];
    if (!batch) return problem("VALIDATION", { detail: "no stock", code: "OUT_OF_STOCK" });
    await db.batch.update({ where: { id: batch.id }, data: { qty: { decrement: item.qty } } });
    await db.drug.update({ where: { id: item.drugId }, data: { stockQty: { decrement: item.qty } } });
    const d = await db.dispensing.create({
      data: {
        prescriptionItemId: item.id, batchId: batch.id, qty: item.qty, status: "dispensed", dispensedBy: actor!.id, dispensedAt: new Date(),
        labelAr: `${item.drug.nameAr} ${item.drug.strength ?? ""} — ${item.frequency}`, labelEn: `${item.drug.nameEn} — ${item.frequency}`,
        counseled: !!b.counseled, paymentStatus: b.paymentStatus ?? "unpaid", deliveredVia: "counter",
      },
    });
    // all items dispensed? then rx status
    const siblings = await db.prescriptionItem.findMany({ where: { prescriptionId: item.prescriptionId } });
    const dispensedCount = await db.dispensing.count({ where: { prescriptionItemId: { in: siblings.map((s) => s.id) }, status: "dispensed" } });
    if (dispensedCount >= siblings.length) {
      await db.prescription.update({ where: { id: item.prescriptionId }, data: { status: "dispensed" } });
    } else {
      await db.prescription.update({ where: { id: item.prescriptionId }, data: { status: "partial" } });
    }
    await audit({ actorId: actor!.id, actorRole: actor!.role, action: "dispense", resource: "prescription-item", resourceId: item.id, patientId: item.prescription.patientId, after: { batch: batch.lotNo, expiry: batch.expiry.toISOString().slice(0, 10), qty: item.qty } });
    return json({ id: d.id, batch: { lotNo: batch.lotNo, expiry: batch.expiry.toISOString().slice(0, 10) }, labelAr: d.labelAr, labelEn: d.labelEn }, 201);
  },
  // Recall (§17.15)
  "POST pharmacy/recall": async (req) => {
    const actor = actorFrom(req);
    if (!actor || !can(actor.role, "pharmacy")) return problem("FORBIDDEN");
    const b = jo(await req.json()) as { lotNo?: string };
    const batch = await db.batch.findFirst({ where: { lotNo: String(b.lotNo) } });
    if (!batch) return problem("NOT_FOUND");
    await db.batch.update({ where: { id: batch.id }, data: { status: "recalled", recallAt: new Date() } });
    const affected = await db.dispensing.findMany({ where: { batchId: batch.id }, include: { prescriptionItem: { include: { prescription: true } } } });
    for (const d of affected) {
      await db.notification.create({ data: { patientId: d.prescriptionItem.prescription.patientId, kind: "recall", titleAr: "راجع الصيدلية بخصوص دوائك", titleEn: "Please revisit the pharmacy about your medication", bodyAr: "تنبيه سلامة — دون تفاصيل", bodyEn: "Safety notice — no details", channel: "sms", status: "sent" } });
    }
    await audit({ actorId: actor!.id, actorRole: actor!.role, action: "recall", resource: "batch", resourceId: batch.id, after: { lotNo: batch.lotNo, patientsNotified: affected.length } });
    return json({ ok: true, lotNo: batch.lotNo, notified: affected.length });
  },
  "GET pharmacy/stock": async (req) => {
    actorFrom(req);
    const drugs = await db.drug.findMany({ orderBy: { nameAr: "asc" } });
    const batches = await db.batch.findMany({ where: { ownerType: "drug" }, orderBy: { expiry: "asc" } });
    return json({
      drugs: drugs.map((d) => ({ code: d.code, nameAr: d.nameAr, nameEn: d.nameEn, form: d.form, strength: d.strength, stockQty: d.stockQty, parLevel: d.parLevel, controlled: d.controlled, refrigerated: d.refrigerated, highAlert: d.highAlert, lookAlike: d.lookAlike, priceFils: d.priceFils, mgPerKg: d.mgPerKg, maxDailyMg: d.maxDailyMg, pregCategory: d.pregCategory })),
      batches: batches.map((b) => ({ lotNo: b.lotNo, qty: b.qty, expiry: b.expiry.toISOString().slice(0, 10), status: b.status, fefoRank: b.expiry.getTime() })),
    });
  },
};
export default routes;
