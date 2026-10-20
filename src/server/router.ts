/**
 * Tiny dispatcher for catch-all route handlers.
 * Usage: export const POST = (req) => dispatch(req, staffRoutes);
 */
import { NextResponse } from "next/server";
import { problem } from "@/lib/api";

export type Handler = (req: Request, url: URL, params: string[]) => Promise<Response>;
export type RouteTable = Record<string, Handler>; // "GET patients/search" | "POST patients"

export async function dispatch(req: Request, url: URL, params: string[], table: RouteTable): Promise<Response> {
  const method = req.method === "HEAD" ? "GET" : req.method;
  const path = params.join("/");
  const key = `${method} ${path}`;
  const h = table[key] ?? table[`${method} ${path.split("/").slice(0, -1).join("/")}/*`];
  if (!h) return problem("NOT_FOUND", { path });
  try {
    return await h(req, url, params);
  } catch (e) {
    console.error(`[api] ${key}`, e);
    return problem("VALIDATION", { detail: String((e as Error)?.message ?? e) }, 500);
  }
}

export const json = (data: unknown, status = 200) => NextResponse.json(data as object, { status });
