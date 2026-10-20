import type { NextRequest } from "next/server";
import { dispatch } from "@/server/router";
import webhooks from "@/server/webhooks";
type Ctx = { params: Promise<{ path: string[] }> };
const GET = (req: NextRequest, ctx: Ctx) => ctx.params.then((p) => dispatch(req, new URL(req.url), p.path ?? [], webhooks));
const POST = (req: NextRequest, ctx: Ctx) => ctx.params.then((p) => dispatch(req, new URL(req.url), p.path ?? [], webhooks));
export { GET, POST };
