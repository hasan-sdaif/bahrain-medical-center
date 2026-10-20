import type { NextRequest } from "next/server";
import { dispatch } from "@/server/router";
import ai from "@/server/ai";
type Ctx = { params: Promise<{ path: string[] }> };
const GET = (req: NextRequest, ctx: Ctx) => ctx.params.then((p) => dispatch(req, new URL(req.url), p.path ?? [], ai));
const POST = (req: NextRequest, ctx: Ctx) => ctx.params.then((p) => dispatch(req, new URL(req.url), p.path ?? [], ai));
export { GET, POST };
