/**
 * Staff billing — invoices (VAT §17.10), payments (idempotent, Benefit sim),
 * cashier shifts, pre-authorizations, claims lifecycle, ledger.
 */
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { problem, ja, jo, actorFrom } from "@/lib/api";
import { nextInvoiceCode, nextPayCode, nextClaimCode, nextPreAuthCode } from "@/lib/numbering";
import { computeInvoiceMath, splitPayer, bpOfFils } from "@/lib/money";
import { VAT_RULES } from "@/lib/types";
import { sha256 } from "@/lib/bahrain";
import { can } from "../perm";
import type { RouteTable } from "../router";
import { json } from "../router";

const routes: RouteTable = {
  // ── Charge capture → invoice ─────────────────────────────────────────────
  "POST invoices/create": async (req) => {
    const actor = actorFrom(req);
    if (!actor || !can(actor.role, "billing")) return problem("FORBIDDEN");
    const b = jo(await req.json()) as { patientId?: string; encounterId?: string; lines?: { kind?: string; nameAr?: string; nameEn?: string; unitFils?: number; qty?: number; isDrug?: boolean; refId?: string }[]; discountFils?: number; neutralDesc?: string; isQuotation?: boolean };
    if (!b.patientId || !b.lines?.length) return problem("VALIDATION");
    const patient = await db.patient.findUnique({ where: { id: b.patientId }, include: { policies: true, flags: true } });
    if (!patient) return problem("NOT_FOUND");
    const psych = patient.flags.some((f) => f.kind === "restricted");
    const lines = b.lines.map((l) => {
      const vatBp = l.isDrug ? VAT_RULES.drug : (VAT_RULES[l.kind ?? "consultation"] ?? VAT_RULES.consultation);
      const unitFils = Math.trunc(Number(l.unitFils ?? 0));
      const qty = Math.max(1, Number(l.qty ?? 1));
      return { kind: l.kind ?? "consultation", nameAr: l.nameAr ?? "", nameEn: l.nameEn ?? "", qty, unitFils, vatBp, grossFils: unitFils * qty, vatFils: bpOfFils(unitFils * qty, vatBp), isDrug: !!l.isDrug, refId: l.refId ?? null };
    });
    const math = computeInvoiceMath(lines.map((l) => ({ unitFils: l.unitFils, qty: l.qty, vatBp: l.vatBp })));
    const discountFils = Math.trunc(Number(b.discountFils ?? 0));
    const totalFils = math.total; // subtotal+vat-discount
    const policy = patient.policies[0];
    const payerView = policy ? splitPayer(totalFils, policy.copayFils, policy.coinsPct, policy.ceilingFils) : { patientDue: totalFils, insurerDue: 0, capped: false };
    const code = await nextInvoiceCode();
    const inv = await db.invoice.create({
      data: {
        code, patientId: patient.id, encounterId: b.encounterId ?? null, status: b.isQuotation ? "draft" : "issued",
        subtotalFils: math.subtotal, discountFils, vatFils: math.vat, totalFils,
        patientFils: payerView.patientDue, insurerFils: payerView.insurerDue, cashierId: actor!.id,
        isQuotation: !!b.isQuotation, neutralDesc: psych ? (b.neutralDesc ?? "استشارة") : null,
        lines: { create: lines.map((l) => ({ kind: l.kind, refId: l.refId, nameAr: psych && l.kind === "consultation" ? "استشارة" : l.nameAr, nameEn: psych && l.kind === "consultation" ? "Consultation" : l.nameEn, qty: l.qty, unitFils: l.unitFils, vatBp: l.vatBp, grossFils: l.grossFils, vatFils: l.vatFils })) },
      },
    });
    await audit({ actorId: actor!.id, actorRole: actor!.role, action: "create", resource: "invoice", resourceId: inv.id, patientId: patient.id, after: { code, totalFils, vatFils: math.vat, split: payerView } });
    return json({ id: inv.id, code, subtotalFils: math.subtotal, vatFils: math.vat, discountFils, totalFils, patientFils: payerView.patientDue, insurerFils: payerView.insurerDue, capped: payerView.capped, lines }, 201);
  },
  "POST invoices/accept-quotation": async (req) => {
    const actor = actorFrom(req);
    if (!actor || !can(actor.role, "billing")) return problem("FORBIDDEN");
    const b = jo(await req.json()) as { invoiceId?: string; acceptedBy?: string };
    const inv = await db.invoice.findUnique({ where: { id: String(b.invoiceId) } });
    if (!inv || !inv.isQuotation) return problem("NOT_FOUND");
    await db.invoice.update({ where: { id: inv.id }, data: { acceptedAt: new Date(), status: "issued" } });
    await audit({ actorId: actor!.id, actorRole: actor!.role, action: "accept-quotation", resource: "invoice", resourceId: inv.id, patientId: inv.patientId, after: { acceptedBy: b.acceptedBy ?? null } });
    return json({ ok: true });
  },
  // ── Payments (idempotency + Benefit gateway sim) ─────────────────────────
  "POST payments/pay": async (req) => {
    const actor = actorFrom(req);
    if (!actor || !can(actor.role, "billing")) return problem("FORBIDDEN");
    const b = jo(await req.json()) as { invoiceId?: string; method?: string; amountFils?: number; idempotencyKey?: string; benefitRef?: string; last4?: string };
    if (!b.invoiceId) return problem("VALIDATION");
    const key = b.idempotencyKey ? sha256(b.idempotencyKey).slice(0, 24) : sha256(`${b.invoiceId}:${Date.now()}`).slice(0, 24);
    const existing = await db.payment.findUnique({ where: { idempotencyKey: key } });
    if (existing) return problem("IDEMPOTENT_DUP", { existingCode: existing.code });
    const inv = await db.invoice.findUnique({ where: { id: b.invoiceId }, include: { lines: true } });
    if (!inv) return problem("NOT_FOUND");
    if (inv.status === "paid") return problem("STATE_INVALID", { detail: "already paid" });
    const method = b.method ?? "cash";
    // Benefit: simulate provider webhook signature verification
    if (method === "benefit") {
      const ref = b.benefitRef ?? `BNF-${Math.floor(Math.random() * 90000 + 10000)}`;
      await db.paymentWebhook.create({ data: { provider: "benefit-sim", signature: `sha1=${sha256(ref).slice(0, 20)}`, payload: { invoice: inv.code, ref }, processed: true } });
      var benefitRef: string | undefined = ref;
    }
    const amount = Math.trunc(Number(b.amountFils ?? inv.totalFils));
    const code = await nextPayCode();
    const pay = await db.payment.create({
      data: { code, invoiceId: inv.id, patientId: inv.patientId, method, amountFils: amount, status: "captured", txnRef: `TXN-${Math.floor(Math.random() * 900000 + 100000)}`, idempotencyKey: key, receivedBy: actor!.id, benefitRef, last4: b.last4 ?? null, receivedAt: new Date() },
    });
    const paid = await db.payment.aggregate({ where: { invoiceId: inv.id, status: "captured" }, _sum: { amountFils: true } });
    const paidFils = paid._sum.amountFils ?? 0;
    await db.invoice.update({ where: { id: inv.id }, data: { status: paidFils >= inv.totalFils ? "paid" : "partial" } });
    await db.ledgerEntry.create({ data: { account: "1100-الصندوق", debitFils: amount, creditFils: 0, memoAr: `تحصيل ${inv.code}`, refType: "payment", refId: pay.id, postedBy: actor!.id } });
    await audit({ actorId: actor!.id, actorRole: actor!.role, action: "payment", resource: "invoice", resourceId: inv.id, patientId: inv.patientId, after: { method, amountFils: amount, code } });
    return json({ id: pay.id, code, method, amountFils: amount, paidSoFar: paidFils, invoiceStatus: paidFils >= inv.totalFils ? "paid" : "partial", receiptQr: `BMC-${sha256(code).slice(0, 22).toUpperCase()}` }, 201);
  },
  "POST shifts/open": async (req) => {
    const actor = actorFrom(req);
    if (!actor || !can(actor.role, "billing")) return problem("FORBIDDEN");
    const b = jo(await req.json()) as { openingFils?: number };
    const s = await db.cashierShift.create({ data: { cashierId: actor!.id, openingFils: Math.trunc(Number(b.openingFils ?? 0)), status: "open", openedAt: new Date() } });
    return json({ id: s.id }, 201);
  },
  "POST shifts/close": async (req) => {
    const actor = actorFrom(req);
    if (!actor || !can(actor.role, "billing")) return problem("FORBIDDEN");
    const b = jo(await req.json()) as { shiftId?: string; countedFils?: number };
    const s = await db.cashierShift.findUnique({ where: { id: String(b.shiftId) } });
    if (!s) return problem("NOT_FOUND");
    const payments = await db.payment.findMany({ where: { receivedBy: actor!.id, receivedAt: { gte: s.openedAt } } });
    const expected = payments.reduce((a, p) => a + p.amountFils, 0) + s.openingFils;
    const counted = Math.trunc(Number(b.countedFils ?? expected));
    await db.cashierShift.update({ where: { id: s.id }, data: { status: "closed", closedAt: new Date(), countedFils: counted, difference: counted - expected, payments: payments.map((p) => ({ code: p.code, method: p.method, amountFils: p.amountFils })) } });
    await audit({ actorId: actor!.id, actorRole: actor!.role, action: "shift-close", resource: "cashier-shift", resourceId: s.id, after: { expected, counted, diff: counted - expected } });
    return json({ expectedFils: expected, countedFils: counted, difference: counted - expected, methods: payments.reduce<Record<string, number>>((acc, p) => { acc[p.method] = (acc[p.method] ?? 0) + p.amountFils; return acc; }, {}) });
  },

  // ── Pre-authorizations ───────────────────────────────────────────────────
  "GET preauths/list": async (req) => {
    const actor = actorFrom(req);
    if (!actor || !can(actor.role, "insurance")) return problem("FORBIDDEN");
    const rows = await db.preAuthorization.findMany({ include: { patient: true }, orderBy: { requestedAt: "desc" } });
    return json(rows.map((p) => ({
      id: p.id, code: p.code, status: p.status, serviceRef: p.serviceRef, requestedAt: p.requestedAt.toISOString(), approvedRef: p.approvedRef, amountFils: p.amountFils,
      patient: { mrn: p.patient.mrn, nameAr: `${p.patient.firstNameAr} ${p.patient.familyAr}` },
    })));
  },
  "POST preauths/request": async (req) => {
    const actor = actorFrom(req);
    if (!actor || !can(actor.role, "insurance")) return problem("FORBIDDEN");
    const b = jo(await req.json()) as { patientId?: string; payerId?: string; serviceRef?: string; amountFils?: number; notes?: string };
    if (!b.patientId || !b.payerId || !b.serviceRef) return problem("VALIDATION");
    const code = await nextPreAuthCode();
    const pa = await db.preAuthorization.create({ data: { code, patientId: b.patientId, payerId: b.payerId, serviceRef: b.serviceRef, status: "submitted", requestedAt: new Date(), amountFils: Math.trunc(Number(b.amountFils ?? 0)), notes: b.notes ?? null } });
    await audit({ actorId: actor!.id, actorRole: actor!.role, action: "create", resource: "preauth", resourceId: pa.id, patientId: b.patientId, after: { code, service: b.serviceRef } });
    return json({ id: pa.id, code }, 201);
  },
  "POST preauths/approve": async (req) => {
    const actor = actorFrom(req);
    if (!actor || !can(actor.role, "insurance")) return problem("FORBIDDEN");
    const b = jo(await req.json()) as { preauthId?: string; approvedRef?: string; validDays?: number; reject?: string };
    const pa = await db.preAuthorization.findUnique({ where: { id: String(b.preauthId) } });
    if (!pa) return problem("NOT_FOUND");
    await db.preAuthorization.update({ where: { id: pa.id }, data: { status: b.reject ? "rejected" : "approved", approvedRef: b.approvedRef ?? `AUTH-${Math.floor(Math.random() * 90000 + 10000)}`, validUntil: b.reject ? null : new Date(Date.now() + (b.validDays ?? 30) * 86400000) } });
    await audit({ actorId: actor!.id, actorRole: actor!.role, action: b.reject ? "reject" : "approve", resource: "preauth", resourceId: pa.id, patientId: pa.patientId, after: { approvedRef: b.approvedRef ?? null } });
    return json({ ok: true });
  },

  // ── Claims ───────────────────────────────────────────────────────────────
  "GET claims/list": async (req) => {
    const actor = actorFrom(req);
    if (!actor || !can(actor.role, "insurance")) return problem("FORBIDDEN");
    const rows = await db.claim.findMany({ orderBy: { submittedAt: "desc" } });
    return json(rows.map((c) => ({ id: c.id, code: c.code, status: c.status, billedFils: c.billedFils, approvedFils: c.approvedFils, rejectReason: c.rejectReason, submittedAt: c.submittedAt?.toISOString() ?? null, patientId: c.patientId })));
  },
  "POST claims/submit": async (req) => {
    const actor = actorFrom(req);
    if (!actor || !can(actor.role, "insurance")) return problem("FORBIDDEN");
    const b = jo(await req.json()) as { invoiceIds?: string[]; patientId?: string; payerId?: string; resubmitOf?: string; correctedCoding?: string };
    const invoices = await db.invoice.findMany({ where: { id: { in: b.invoiceIds ?? [] } } });
    if (!invoices.length) return problem("VALIDATION");
    const billed = invoices.reduce((a, i) => a + i.insurerFils, 0);
    const code = await nextClaimCode();
    const c = await db.claim.create({
      data: { code, patientId: b.patientId ?? invoices[0].patientId, payerId: b.payerId ?? (await db.insurancePolicy.findFirst({ where: { patientId: invoices[0].patientId } }))?.payerId ?? "", invoiceIds: invoices.map((i) => i.id), status: "submitted", submittedAt: new Date(), billedFils: billed, resubmittedAt: b.resubmitOf ? new Date() : null },
    });
    await audit({ actorId: actor!.id, actorRole: actor!.role, action: b.resubmitOf ? "resubmit" : "submit", resource: "claim", resourceId: c.id, patientId: c.patientId, after: { code, billedFils: billed, correctedCoding: b.correctedCoding ?? null } });
    return json({ id: c.id, code, billedFils: billed }, 201);
  },
  "POST claims/remit": async (req) => {
    const actor = actorFrom(req);
    if (!actor || !can(actor.role, "insurance")) return problem("FORBIDDEN");
    const b = jo(await req.json()) as { claimId?: string; approve?: boolean; partial?: boolean; rejectReason?: string; approvedFils?: number };
    const c = await db.claim.findUnique({ where: { id: String(b.claimId) } });
    if (!c) return problem("NOT_FOUND");
    const status = b.rejectReason ? "rejected" : b.partial ? "partial-paid" : "paid";
    await db.claim.update({ where: { id: c.id }, data: { status, approvedFils: b.approvedFils ?? c.billedFils, rejectReason: b.rejectReason ?? null, remittedAt: new Date() } });
    await db.ledgerEntry.create({ data: { account: "1200-ذمم تأمين", debitFils: 0, creditFils: b.approvedFils ?? c.billedFils, memoAr: `تسوية مطالبة ${c.code}`, refType: "claim", refId: c.id, postedBy: actor!.id } });
    await audit({ actorId: actor!.id, actorRole: actor!.role, action: "remit", resource: "claim", resourceId: c.id, after: { status, approvedFils: b.approvedFils ?? c.billedFils } });
    return json({ ok: true, status });
  },
};
export default routes;
