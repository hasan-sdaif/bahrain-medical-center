import type { NextRequest } from "next/server";
import { dispatch } from "@/server/router";
import devices from "@/server/devices";
type Ctx = { params: Promise<{ path: string[] }> };
const GET = (req: NextRequest, ctx: Ctx) => ctx.params.then((p) => dispatch(req, new URL(req.url), p.path ?? [], devices));
const POST = (req: NextRequest, ctx: Ctx) => ctx.params.then((p) => dispatch(req, new URL(req.url), p.path ?? [], devices));
export { GET, POST };
