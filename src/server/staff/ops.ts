/**
 * Staff ops — home care routing (§17.11), CMMS (scan/assets, faults, work
 * orders + technician chat + parts), inventory, quality, HR, reports, audit.
 */
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { problem, ja, jo, actorFrom } from "@/lib/api";
import { nextHvCode, nextFrCode, nextWoCode } from "@/lib/numbering";
import { planRoute, type RoutableVisit } from "@/lib/algorithms";
import { can, modulesFor } from "../perm";
import type { RouteTable } from "../router";
import { json } from "../router";

const routes: RouteTable = {
  // ── Home care ────────────────────────────────────────────────────────────
  "GET home/requests": async (req) => {
    const actor = actorFrom(req);
    if (!actor || !can(actor.role, "home")) return problem("FORBIDDEN");
    const rows = await db.homeRequest.findMany({ include: { patient: true, visit: true }, orderBy: { createdAt: "desc" } });
    const zones = await db.coverageZone.findMany();
    return json({
      zones: zones.map((z) => ({ id: z.id, governorate: z.governorate, feeFils: z.feeFils, areas: ja(z.areas) })),
      requests: rows.map((r) => ({
        id: r.id, code: r.code, status: r.status, channel: r.channel, fasting: r.fasting, slot: r.slot,
        feeFils: r.feeFils, tests: ja(r.tests), address: jo(r.address), prefGender: r.prefGender,
        patient: { mrn: r.patient.mrn, nameAr: `${r.patient.firstNameAr} ${r.patient.familyAr}`, phone: r.patient.phone, dob: r.patient.dob.toISOString() },
        visit: r.visit ? { id: r.visit.id, collectorId: r.visit.collectorId, eta: r.visit.eta?.toISOString() ?? null, status: r.status } : null,
        createdAt: r.createdAt.toISOString(),
      })),
    });
  },
  "POST home/confirm": async (req) => {
    const actor = actorFrom(req);
    if (!actor || !can(actor.role, "home")) return problem("FORBIDDEN");
    const b = jo(await req.json()) as { requestId?: string; feeFils?: number };
    const r = await db.homeRequest.findUnique({ where: { id: String(b.requestId) } });
    if (!r) return problem("NOT_FOUND");
    await db.homeRequest.update({ where: { id: r.id }, data: { status: "confirmed", confirmedAt: new Date(), feeFils: b.feeFils ?? r.feeFils } });
    await audit({ actorId: actor!.id, actorRole: actor!.role, action: "confirm", resource: "home-request", resourceId: r.id, patientId: r.patientId, after: { feeFils: b.feeFils ?? r.feeFils } });
    return json({ ok: true });
  },
  // §17.11 NN + 2-opt routing for a given morning
  "POST home/plan-routes": async (req) => {
    const actor = actorFrom(req);
    if (!actor || !can(actor.role, "home")) return problem("FORBIDDEN");
    const b = jo(await req.json()) as { date?: string };
    const confirmed = await db.homeRequest.findMany({ where: { status: { in: ["confirmed", "assigned"] } }, include: { patient: true, visit: true } });
    const collectors = await db.employee.findMany({ where: { role: "collector" } });
    const depot = { lat: 26.2285, lng: 50.586 };
    // group by governorate (zone-based assignment)
    const byZone = new Map<string, RoutableVisit[]>();
    for (const r of confirmed) {
      const addr = jo(r.address) as { governorate?: string; area?: string; block?: string; building?: string };
      const lat = 26.2 + (addr.block ? (Number(addr.block) % 40) / 400 : 0.02);
      const lng = 50.55 + (addr.block ? (Number(addr.block) % 30) / 300 : 0.02);
      const list = byZone.get(addr.governorate ?? "capital") ?? [];
      list.push({ id: r.id, lat, lng, fasting: r.fasting, addr: `${addr.area ?? ""} بلوك ${addr.block ?? ""} — ${addr.building ?? ""}` });
      byZone.set(addr.governorate ?? "capital", list);
    }
    const routes: { zone: string; collector: { id: string; nameAr: string } | null; order: { seq: number; addr: string; fasting: boolean; etaMin: number }[]; totalKm: number; warnings: string[] }[] = [];
    let i = 0;
    for (const [zone, visits] of byZone) {
      const collector = collectors[i % Math.max(1, collectors.length)];
      const planned = planRoute(visits, depot);
      routes.push({ zone, collector: collector ? { id: collector.id, nameAr: collector.nameAr } : null, order: planned.order.map((v, idx) => ({ seq: idx + 1, addr: v.addr, fasting: v.fasting, etaMin: planned.etasMin[idx] })), totalKm: planned.totalKm, warnings: planned.warnings });
      i++;
    }
    for (const r of confirmed) {
      await db.homeRequest.update({ where: { id: r.id }, data: { status: "assigned" } });
    }
    await audit({ actorId: actor!.id, actorRole: actor!.role, action: "plan-routes", resource: "home-request", after: { zones: byZone.size, visits: confirmed.length } });
    return json({ routes, algorithm: "nearest-neighbor + 2-opt + fasting-first" });
  },
  "POST home/visit-status": async (req) => {
    const actor = actorFrom(req);
    if (!actor || !can(actor.role, "home")) return problem("FORBIDDEN");
    const b = jo(await req.json()) as { visitId?: string; status?: string; otpShown?: boolean; paymentMethod?: string; amountFils?: number; sampleTempC?: number; incident?: string };
    const v = await db.homeVisit.findUnique({ where: { id: String(b.visitId) } });
    if (!v) return problem("NOT_FOUND");
    const request = await db.homeRequest.findUnique({ where: { id: v.requestId } });
    await db.homeVisit.update({
      where: { id: v.id },
      data: {
        arrivedAt: b.status === "arrived" ? new Date() : v.arrivedAt, drawnAt: b.status === "drawn" ? new Date() : v.drawnAt,
        otpShown: b.otpShown ?? v.otpShown, paymentMethod: b.paymentMethod ?? v.paymentMethod, amountFils: b.amountFils ?? v.amountFils,
        sampleTempC: b.sampleTempC ?? v.sampleTempC,
        handedAt: b.status === "to-lab" ? new Date() : v.handedAt,
        incidents: (b.incident ? [...ja(v.incidents), { at: new Date().toISOString(), text: b.incident }] : v.incidents) as object[],
        coldChain: (b.sampleTempC != null ? [...ja(v.coldChain), { at: new Date().toISOString(), tempC: b.sampleTempC }] : v.coldChain) as object[],
      },
    });
    if (request && b.status) {
      await db.homeRequest.update({ where: { id: request.id }, data: { status: b.status } });
    }
    await audit({ actorId: actor!.id, actorRole: actor!.role, action: "visit-status", resource: "home-visit", resourceId: v.id, patientId: request?.patientId, after: { status: b.status } });
    return json({ ok: true, status: b.status });
  },

  // ── Maintenance: barcode-first asset file ───────────────────────────────
  "GET maintenance/assets": async (req, url) => {
    const actor = actorFrom(req);
    if (!actor) return problem("UNAUTHORIZED");
    const code = url.searchParams.get("code"); // barcode = AST code
    const rows = code ? await db.asset.findMany({ where: { OR: [{ code: code }, { nameAr: { contains: code } }] } }) : await db.asset.findMany();
    const plans = await db.maintenancePlan.findMany();
    return json({
      plans: plans.map((p) => ({ id: p.id, titleAr: p.titleAr, titleEn: p.titleEn, frequencyDays: p.frequencyDays, checklist: ja(p.checklist), parts: ja(p.parts), estMinutes: p.estMinutes })),
      assets: rows.map((a) => ({
        id: a.id, code: a.code, nameAr: a.nameAr, nameEn: a.nameEn, category: a.category, status: a.status,
        serialNo: a.serialNo, model: a.model, costFils: a.costFils, warrantyUntil: a.warrantyUntil?.toISOString().slice(0, 10) ?? null,
        calibrationDueAt: a.calibrationDueAt?.toISOString().slice(0, 10) ?? null, downtimeMin: a.downtimeMin, notes: a.notes,
      })),
    });
  },
  "POST maintenance/report-fault": async (req) => {
    const actor = actorFrom(req);
    if (!actor) return problem("UNAUTHORIZED"); // any staff can report by scanning asset barcode
    const b = jo(await req.json()) as { assetCode?: string; description?: string; impact?: string; category?: string; photos?: string[] };
    const asset = await db.asset.findUnique({ where: { code: String(b.assetCode) } });
    if (!asset) return problem("NOT_FOUND", { detail: "asset not found by barcode" });
    const code = await nextFrCode();
    const fr = await db.maintenanceRequest.create({
      data: { code, assetId: asset.id, reportedBy: actor!.id, description: b.description ?? "", impact: b.impact ?? "partial", category: b.category ?? "mechanical", photos: b.photos ?? [], status: "new" },
    });
    // auto work order + asset to in-maintenance when impact != none
    const woCode = await nextWoCode();
    const slaHours = b.impact === "full" ? 4 : b.impact === "partial" ? 24 : 72;
    const tech = await db.employee.findFirst({ where: { role: "maintenance-tech" } });
    const wo = await db.workOrder.create({
      data: { code: woCode, kind: "corrective", assetId: asset.id, requestId: fr.id, technicianId: tech?.id ?? null, priority: b.impact === "full" ? "high" : "normal", status: "assigned", slaDueAt: new Date(Date.now() + slaHours * 3600000), checklist: { steps: [] } },
    });
    await db.maintenanceRequest.update({ where: { id: fr.id }, data: { status: "assigned", workOrder: undefined } });
    await db.asset.update({ where: { id: asset.id }, data: { status: b.impact === "none" ? "operational" : "in-maintenance", downtimeMin: { increment: 0 } } });
    await db.workOrderMessage.create({ data: { workOrderId: wo.id, body: `تم فتح بلاغ ${code} لأصل ${asset.code} — ${b.description ?? ""}`, kind: "system" } });
    await db.notification.create({ data: { userId: tech?.id ?? null, role: "maintenance-tech", kind: "wo-assigned", titleAr: `أمر عمل ${woCode}`, titleEn: `Work order ${woCode}`, bodyAr: `${asset.nameAr} — ${b.impact === "full" ? "يوقف الخدمة كلياً" : b.impact === "partial" ? "يوقف جزئياً" : "يمكن العمل به"}`, bodyEn: asset.nameEn, channel: "inapp", status: "sent" } });
    await audit({ actorId: actor!.id, actorRole: actor!.role, action: "report-fault", resource: "asset", resourceId: asset.id, after: { code, impact: b.impact, wo: woCode } });
    return json({ requestId: fr.id, code, workOrder: { id: wo.id, code: woCode, slaDueAt: wo.slaDueAt?.toISOString() } }, 201);
  },
  "GET maintenance/work-orders": async (req) => {
    const actor = actorFrom(req);
    if (!actor || !can(actor.role, "maintenance")) return problem("FORBIDDEN");
    const rows = await db.workOrder.findMany({ include: { asset: true, messages: { orderBy: { at: "asc" } }, parts: true }, orderBy: { createdAt: "desc" }, take: 30 });
    return json(rows.map((w) => ({
      id: w.id, code: w.code, kind: w.kind, status: w.status, priority: w.priority,
      asset: { code: w.asset.code, nameAr: w.asset.nameAr, nameEn: w.asset.nameEn, category: w.asset.category },
      technicianId: w.technicianId, slaDueAt: w.slaDueAt?.toISOString() ?? null, dueIn: w.slaDueAt ? Math.round((w.slaDueAt.getTime() - Date.now()) / 60000) : null,
      startedAt: w.startedAt?.toISOString() ?? null, finishedAt: w.finishedAt?.toISOString() ?? null, closedAt: w.closedAt?.toISOString() ?? null,
      rootCauseAr: w.rootCauseAr, actionAr: w.actionAr, downtimeMin: w.downtimeMin, checklist: jo(w.checklist),
      messages: w.messages.map((m) => ({ id: m.id, senderId: m.senderId, body: m.body, kind: m.kind, at: m.at.toISOString() })),
      parts: w.parts.map((p) => ({ id: p.id, itemCode: p.itemCode, qty: p.qty, issuedAt: p.issuedAt?.toISOString() ?? null })),
      overSla: !!w.slaDueAt && w.status !== "closed" && w.slaDueAt.getTime() < Date.now(),
    })));
  },
  "POST maintenance/wo-message": async (req) => {
    const actor = actorFrom(req);
    if (!actor) return problem("UNAUTHORIZED");
    const b = jo(await req.json()) as { workOrderId?: string; body?: string; kind?: string };
    if (!b.workOrderId || !b.body) return problem("VALIDATION");
    const m = await db.workOrderMessage.create({ data: { workOrderId: b.workOrderId, senderId: actor!.id, body: b.body, kind: b.kind ?? "text" } });
    await audit({ actorId: actor!.id, actorRole: actor!.role, action: "wo-message", resource: "work-order", resourceId: b.workOrderId, after: { kind: b.kind } });
    return json({ id: m.id }, 201);
  },
  "POST maintenance/wo-status": async (req) => {
    const actor = actorFrom(req);
    if (!actor || !can(actor.role, "maintenance")) return problem("FORBIDDEN");
    const b = jo(await req.json()) as { workOrderId?: string; status?: string; note?: string };
    const w = await db.workOrder.findUnique({ where: { id: String(b.workOrderId) } });
    if (!w) return problem("NOT_FOUND");
    const status = b.status ?? "in-progress";
    await db.workOrder.update({
      where: { id: w.id },
      data: {
        status, startedAt: status === "in-progress" && !w.startedAt ? new Date() : w.startedAt,
        awaiting: undefined, rootCauseAr: status === "awaiting-part" ? (b.note ?? w.rootCauseAr) : w.rootCauseAr,
      } as never,
    });
    if (status === "in-progress") await db.asset.update({ where: { id: w.assetId }, data: { status: "in-maintenance" } });
    await db.workOrderMessage.create({ data: { workOrderId: w.id, body: `تحول الحالة إلى ${status}${b.note ? ` — ${b.note}` : ""}`, kind: "system" } });
    await audit({ actorId: actor!.id, actorRole: actor!.role, action: "wo-status", resource: "work-order", resourceId: w.id, after: { status } });
    return json({ ok: true, status });
  },
  "POST maintenance/wo-close": async (req) => {
    const actor = actorFrom(req);
    if (!actor || !can(actor.role, "maintenance")) return problem("FORBIDDEN");
    const b = jo(await req.json()) as { workOrderId?: string; rootCauseAr?: string; actionAr?: string; downtimeMin?: number; signatureBy?: string };
    const w = await db.workOrder.findUnique({ where: { id: String(b.workOrderId) }, include: { parts: true } });
    if (!w) return problem("NOT_FOUND");
    const downtime = b.downtimeMin ?? w.downtimeMin ?? 0;
    await db.workOrder.update({
      where: { id: w.id },
      data: { status: "closed", finishedAt: new Date(), closedAt: new Date(), closedBy: actor!.id, rootCauseAr: b.rootCauseAr ?? w.rootCauseAr, actionAr: b.actionAr ?? w.actionAr, downtimeMin: downtime, signatureBy: b.signatureBy ?? w.signatureBy },
    });
    // issue reserved parts (deduct from stock)
    for (const p of w.parts) {
      if (p.batchId && !p.issuedAt) {
        const batch = await db.batch.findUnique({ where: { id: p.batchId } });
        if (batch) {
          await db.batch.update({ where: { id: batch.id }, data: { qty: { decrement: p.qty } } });
          await db.stockMove.create({ data: { batchId: batch.id, fromBin: "ST-01", qty: p.qty, type: "issue", refType: "work-order", refId: w.id, byId: actor!.id, reason: "صرف قطعة غيار" } });
        }
      }
      await db.workOrderPart.update({ where: { id: p.id }, data: { issuedAt: new Date() } });
    }
    await db.asset.update({ where: { id: w.assetId }, data: { status: "operational", downtimeMin: { increment: downtime } } });
    await db.workOrderMessage.create({ data: { workOrderId: w.id, body: `تم الإغلاق — سبب العطل: ${b.rootCauseAr ?? ""}. زمن التوقف ${downtime} دقيقة.`, kind: "system" } });
    await audit({ actorId: actor!.id, actorRole: actor!.role, action: "wo-close", resource: "work-order", resourceId: w.id, after: { downtime, parts: w.parts.length, signatureBy: b.signatureBy ?? null } });
    return json({ ok: true, downtimeMin: downtime, mttrMin: downtime });
  },
  "GET maintenance/metrics": async (req) => {
    const actor = actorFrom(req);
    if (!actor || !can(actor.role, "maintenance")) return problem("FORBIDDEN");
    const closed = await db.workOrder.findMany({ where: { status: "closed" } });
    const assets = await db.asset.findMany();
    const mttr = closed.length ? Math.round(closed.reduce((a, w) => a + (w.downtimeMin ?? 0), 0) / closed.length) : 0;
    const byCategory: Record<string, number> = {};
    for (const a of assets) byCategory[a.category] = (byCategory[a.category] ?? 0) + 1;
    return json({
      workOrders: { total: closed.length + (await db.workOrder.count()), closed: closed.length, open: await db.workOrder.count({ where: { status: { in: ["open", "assigned", "in-progress", "awaiting-part"] } } }) },
      mttrMin: mttr,
      mtbfDays: closed.length >= 2 ? Math.round(90 / closed.length) : null,
      assetsByStatus: assets.reduce<Record<string, number>>((acc, a) => { acc[a.status] = (acc[a.status] ?? 0) + 1; return acc; }, {}),
      assetsByCategory: byCategory,
      topDowntime: assets.slice().sort((a, b) => (b.downtimeMin ?? 0) - (a.downtimeMin ?? 0)).slice(0, 5).map((a) => ({ code: a.code, nameAr: a.nameAr, downtimeMin: a.downtimeMin, costFils: a.costFils, ratio: a.costFils ? Math.round((((a.downtimeMin ?? 0) * 500) / a.costFils) * 1000) / 10 : 0 })),
    });
  },

  // ── Inventory ────────────────────────────────────────────────────────────
  "GET inventory/items": async (req) => {
    const actor = actorFrom(req);
    if (!actor || !can(actor.role, "inventory")) return problem("FORBIDDEN");
    const items = await db.item.findMany({ orderBy: { code: "asc" } });
    const batches = await db.batch.findMany({ where: { ownerType: "item" }, orderBy: { expiry: "asc" } });
    const moves = await db.stockMove.findMany({ orderBy: { at: "desc" }, take: 20 });
    return json({
      items: items.map((i) => ({ code: i.code, nameAr: i.nameAr, nameEn: i.nameEn, category: i.category, uom: i.uom, costFils: i.costFils, parLevel: i.parLevel, reorderQty: i.reorderQty, controlled: i.controlled, storage: i.storage, barcode: i.barcode })),
      batches: batches.map((b) => ({ lotNo: b.lotNo, qty: b.qty, expiry: b.expiry.toISOString().slice(0, 10), status: b.status })),
      moves: moves.map((m) => ({ id: m.id, type: m.type, qty: m.qty, fromBin: m.fromBin, toBin: m.toBin, at: m.at.toISOString(), reason: m.reason })),
    });
  },

  // ── Quality ──────────────────────────────────────────────────────────────
  "GET quality/overview": async (req) => {
    const actor = actorFrom(req);
    if (!actor || !can(actor.role, "quality")) return problem("FORBIDDEN");
    const incidents = await db.incident.findMany({ orderBy: { at: "desc" }, take: 20 });
    const complaints = await db.complaint.findMany({ orderBy: { createdAt: "desc" } as never, take: 20 } as never);
    const capas = await db.capa.findMany();
    const surveys = await db.surveyResponse.findMany();
    const nps = surveys.length ? Math.round(surveys.reduce((a, s) => a + (s.nps ?? 0), 0) / surveys.length) : 0;
    return json({
      incidents: incidents.map((i) => ({ id: i.id, code: i.code, type: i.type, severity: i.severity, description: i.description, status: i.status, at: i.at.toISOString() })),
      complaints: (complaints as { id: string; code: string; category: string; description: string; status: string; slaDueAt: Date | null; resolutionAr: string | null }[]).map((c) => ({ ...c, slaDueAt: c.slaDueAt?.toISOString() ?? null, overSla: !!c.slaDueAt && c.status !== "closed" && c.slaDueAt.getTime() < Date.now() })),
      capas: capas.map((c) => ({ id: c.id, code: c.code, status: c.status, actionAr: c.actionAr, dueAt: c.dueAt?.toISOString().slice(0, 10) ?? null })),
      nps, surveyCount: surveys.length,
    });
  },
  "POST quality/incident": async (req) => {
    const actor = actorFrom(req);
    if (!actor) return problem("UNAUTHORIZED");
    const b = jo(await req.json()) as { type?: string; severity?: string; description?: string; patientId?: string; anonymous?: boolean };
    const code = `INC-${new Date().toISOString().slice(2, 10).replace(/-/g, "")}-${Math.floor(Math.random() * 900 + 100)}`;
    const i = await db.incident.create({ data: { code, type: b.type ?? "service", severity: b.severity ?? "minor", description: b.description ?? "", patientId: b.patientId ?? null, reporterId: actor!.id, anonymous: !!b.anonymous } });
    await audit({ actorId: actor!.id, actorRole: actor!.role, action: "create", resource: "incident", resourceId: i.id, after: { severity: b.severity } });
    return json({ id: i.id, code }, 201);
  },

  // ── Reports ──────────────────────────────────────────────────────────────
  "GET reports/overview": async (req) => {
    const actor = actorFrom(req);
    if (!actor || !can(actor.role, "reports")) return problem("FORBIDDEN");
    const [patients, appts, encounters, invoices, payments, claims, results, rxs, homeReqs, won] = await Promise.all([
      db.patient.count(), db.appointment.count(), db.encounter.count(),
      db.invoice.aggregate({ _sum: { totalFils: true } }), db.payment.aggregate({ _sum: { amountFils: true } }),
      db.claim.findMany(), db.labResult.count(), db.prescription.count(),
      db.homeRequest.count(), db.workOrder.count(),
    ]);
    const dailyRevenue: Record<string, number> = {};
    const invRows = await db.invoice.findMany({ where: { status: { in: ["issued", "partial", "paid"] } } });
    for (const inv of invRows) {
      const k = inv.issuedAt.toISOString().slice(0, 10);
      dailyRevenue[k] = (dailyRevenue[k] ?? 0) + inv.totalFils;
    }
    return json({
      kpis: {
        patients, appointments: appts, encounters,
        revenueFils: invoices._sum.totalFils ?? 0, collectedFils: payments._sum.amountFils ?? 0,
        claims: { total: claims.length, rejected: claims.filter((c) => c.status === "rejected").length },
        labResults: results, prescriptions: rxs, homeRequests: homeReqs, workOrders: won,
      },
      dailyRevenue: Object.entries(dailyRevenue).sort().map(([date, fils]) => ({ date, fils })),
      deptVolume: (await db.appointment.groupBy({ by: ["departmentId"], _count: true })).length,
    });
  },

  // ── Audit search (auditor/dpo/sysadmin) ──────────────────────────────────
  "GET audit/search": async (req, url) => {
    const actor = actorFrom(req);
    if (!actor || !["auditor", "dpo", "sysadmin", "med-director"].includes(actor.role)) return problem("FORBIDDEN");
    const action = url.searchParams.get("action") ?? undefined;
    const patientId = url.searchParams.get("patientId") ?? undefined;
    const rows = await db.auditEvent.findMany({
      where: { AND: [action ? { action } : {}, patientId ? { patientId } : {}] },
      orderBy: { at: "desc" }, take: 50,
    });
    await audit({ actorId: actor.id, actorRole: actor.role, action: "audit-search", resource: "audit", after: { action, patientId } });
    return json(rows.map((e) => ({ id: e.id, at: e.at.toISOString(), actorId: e.actorId, actorRole: e.actorRole, action: e.action, resource: e.resource, resourceId: e.resourceId, patientId: e.patientId, reason: e.reason, hash: e.hash.slice(0, 12) })));
  },

  // ── HR ───────────────────────────────────────────────────────────────────
  "GET hr/employees": async (req) => {
    const actor = actorFrom(req);
    if (!actor || !can(actor.role, "hr")) return problem("FORBIDDEN");
    const rows = await db.employee.findMany({ include: { department: true }, orderBy: { staffNo: "asc" } });
    const licenses = await db.facilityLicense.findMany();
    return json({
      employees: rows.map((e) => ({
        id: e.id, staffNo: e.staffNo, nameAr: e.nameAr, nameEn: e.nameEn, role: e.role, jobTitleAr: e.jobTitleAr, jobTitleEn: e.jobTitleEn,
        department: e.department ? { code: e.department.code, nameAr: e.department.nameAr } : null,
        licenseNo: e.licenseNo, licenseExpiresAt: e.licenseExpiresAt?.toISOString().slice(0, 10) ?? null,
        licenseDaysLeft: e.licenseExpiresAt ? Math.round((e.licenseExpiresAt.getTime() - Date.now()) / 86400000) : null,
        active: e.active, phone: e.phone, email: e.email,
      })),
      facilityLicenses: licenses.map((l) => ({ kind: l.kind, nameAr: l.nameAr, number: l.number, expiresAt: l.expiresAt.toISOString().slice(0, 10), daysLeft: Math.round((l.expiresAt.getTime() - Date.now()) / 86400000) })),
    });
  },
  "GET settings/list": async (req) => {
    const actor = actorFrom(req);
    if (!actor || !["sysadmin", "med-director", "dpo", "center-manager"].includes(actor.role)) return problem("FORBIDDEN");
    const [settings, flags, seqs, licenses] = await Promise.all([
      db.setting.findMany({ orderBy: { key: "asc" } }),
      db.featureFlag.findMany(),
      db.numberSequence.findMany({ orderBy: { key: "asc" } }),
      db.facilityLicense.findMany(),
    ]);
    return json({
      settings: settings.map((s) => ({ key: s.key, value: s.value, group: s.group, version: s.version })),
      flags: flags.map((f) => ({ key: f.key, enabled: f.enabled, description: f.description })),
      sequences: seqs.map((q) => ({ key: q.key, next: q.next })),
      licenses: licenses.map((l) => ({ kind: l.kind, nameAr: l.nameAr, number: l.number, expiresAt: l.expiresAt.toISOString().slice(0, 10), daysLeft: Math.round((l.expiresAt.getTime() - Date.now()) / 86400000) })),
    });
  },
  "GET audit/chain": async (req) => {
    const actor = actorFrom(req);
    if (!actor || !["sysadmin", "dpo", "auditor", "med-director"].includes(actor.role)) return problem("FORBIDDEN");
    const { verifyAuditChain } = await import("@/lib/audit");
    return json(await verifyAuditChain(500));
  },
  "GET me/modules": async (req) => {
    const actor = actorFrom(req);
    if (!actor) return problem("UNAUTHORIZED");
    return json({ modules: modulesFor(actor.role), role: actor.role });
  },
};
void nextHvCode;
export default routes;
