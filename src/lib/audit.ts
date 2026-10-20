/**
 * Audit log — append-only + hash chain (§16.4). Every clinical/financial/security
 * action lands here. "من اطلع على ملفي" reads from this table too.
 */
import { db } from "./db";
import { sha256 } from "./bahrain";
import type { Prisma } from "@prisma/client";

export interface AuditInput {
  actorId?: string | null;
  actorRole?: string | null;
  action: string; // view|create|update|sign|approve|cancel|print|export|login|break-glass|...
  resource: string; // patient|appointment|order|result|invoice|consent|asset|work-order|setting|...
  resourceId?: string | null;
  patientId?: string | null;
  before?: unknown;
  after?: unknown;
  reason?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  correlationId?: string | null;
}

export async function audit(input: AuditInput): Promise<void> {
  try {
    const last = await db.auditEvent.findFirst({ orderBy: { at: "desc" }, select: { hash: true } });
    const prevHash = last?.hash ?? "GENESIS";
    const at = new Date();
    const payload = JSON.stringify({
      at: at.toISOString(), actorId: input.actorId ?? null, action: input.action,
      resource: input.resource, resourceId: input.resourceId ?? null,
      patientId: input.patientId ?? null, after: input.after ?? null,
      reason: input.reason ?? null, correlationId: input.correlationId ?? null,
    });
    const hash = sha256(`${prevHash}|${payload}`);
    await db.auditEvent.create({
      data: {
        at,
        actorId: input.actorId ?? null,
        actorRole: input.actorRole ?? null,
        action: input.action,
        resource: input.resource,
        resourceId: input.resourceId ?? null,
        patientId: input.patientId ?? null,
        before: (input.before ?? undefined) as Prisma.InputJsonValue | undefined,
        after: (input.after ?? undefined) as Prisma.InputJsonValue | undefined,
        reason: input.reason ?? null,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
        correlationId: input.correlationId ?? null,
        hash,
        prevHash,
      },
    });
  } catch {
    // audit must never break the request path; failures are swallowed (logged by caller if needed)
  }
}

export async function verifyAuditChain(limit = 500): Promise<{ ok: boolean; checked: number; brokenAt: string | null }> {
  const events = await db.auditEvent.findMany({ orderBy: { at: "desc" }, take: limit });
  const asc = [...events].reverse();
  for (let i = 1; i < asc.length; i++) {
    if (asc[i].prevHash !== asc[i - 1].hash) {
      return { ok: false, checked: i, brokenAt: asc[i].id };
    }
  }
  return { ok: true, checked: asc.length, brokenAt: null };
}
