/**
 * API client (browser) — injects the demo actor (X-BMC-Actor header) from the
 * session store; production swaps this for OIDC tokens with aud checks.
 */
"use client";
import { useApp } from "@/store/app";

export interface ApiOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
}

function actorHeader(): Record<string, string> {
  const { staff, patient } = useApp.getState();
  if (patient && !staff) {
    const actor = { id: patient.patientId, role: "patient", nameAr: patient.nameAr, nameEn: patient.nameEn, patientId: patient.patientId, audience: "patient" };
    return { "x-bmc-actor": btoa(unescape(encodeURIComponent(JSON.stringify(actor)))) };
  }
  if (staff) {
    const actor = { id: staff.employeeId, role: staff.role, nameAr: staff.nameAr, nameEn: staff.nameEn, departmentId: staff.departmentId ?? null, audience: "staff" };
    return { "x-bmc-actor": btoa(unescape(encodeURIComponent(JSON.stringify(actor)))) };
  }
  return {};
}

export async function api<T = unknown>(path: string, opts: ApiOptions = {}): Promise<T> {
  const res = await fetch(path, {
    method: opts.method ?? "GET",
    headers: { "content-type": "application/json", ...actorHeader() },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    signal: opts.signal,
    cache: "no-store",
  });
  if (!res.ok) {
    let detail: Record<string, unknown> = {};
    try { detail = (await res.json()) as Record<string, unknown>; } catch { /* problem+json may fail */ }
    const err = new Error(String(detail.detailEn ?? detail.detail ?? res.status)) as Error & { problem?: Record<string, unknown>; status?: number };
    err.problem = detail;
    err.status = res.status;
    throw err;
  }
  return (await res.json()) as T;
}

export const apiGet = <T,>(path: string, signal?: AbortSignal) => api<T>(path, { signal });
export const apiPost = <T,>(path: string, body?: unknown) => api<T>(path, { method: "POST", body });
