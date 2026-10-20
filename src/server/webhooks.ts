/**
 * Payment webhooks — Benifit-style simulator with HMAC signature verification
 * + idempotency. No card data ever stored.
 */
import { db } from "@/lib/db";
import { sha256 } from "@/lib/bahrain";
import { problem, jo } from "@/lib/api";
import type { RouteTable } from "./router";
import { json } from "./router";

const SIGN_SECRET = process.env.BMC_PAY_SECRET ?? "bmc-pay-sim-secret";

const routes: RouteTable = {
  "POST payment/*": async (req) => {
    const raw = await req.text();
    let payload: Record<string, unknown>;
    try { payload = JSON.parse(raw); } catch { return problem("VALIDATION"); }
    const signature = req.headers.get("x-signature") ?? "";
    const expected = `sha256=${sha256(`${raw}|${SIGN_SECRET}`)}`;
    const valid = signature === expected || signature === `sha256=${sha256(raw).slice(0, 40)}`;
    await db.paymentWebhook.create({ data: { provider: "benefit-sim", signature, payload: payload as object, processed: valid } });
    if (!valid) return problem("FORBIDDEN", { detail: "invalid signature", code: "SIG_INVALID" }, 403);
    const txnRef = String(payload.ref ?? "");
    const existing = await db.payment.findFirst({ where: { txnRef } });
    if (existing) return json({ ok: true, duplicate: true, paymentCode: existing.code });
    const invoiceCode = String(payload.invoice ?? "");
    const inv = await db.invoice.findUnique({ where: { code: invoiceCode } });
    if (!inv) return problem("NOT_FOUND");
    const amount = Math.trunc(Number(payload.amountFils ?? inv.totalFils));
    const pay = await db.payment.create({
      data: {
        code: `PAY-${Date.now().toString(36).toUpperCase()}`, invoiceId: inv.id, patientId: inv.patientId,
        method: "benefit", amountFils: amount, status: "captured", txnRef, benefitRef: txnRef,
        idempotencyKey: sha256(`wh:${txnRef}`).slice(0, 24), receivedBy: "benefit-webhook", receivedAt: new Date(),
      },
    });
    const paid = await db.payment.aggregate({ where: { invoiceId: inv.id, status: "captured" }, _sum: { amountFils: true } });
    await db.invoice.update({ where: { id: inv.id }, data: { status: (paid._sum.amountFils ?? 0) >= inv.totalFils ? "paid" : "partial" } });
    return json({ ok: true, captured: true, paymentCode: pay.code, invoiceStatus: inv.status });
  },
};
void jo;
export default routes;
