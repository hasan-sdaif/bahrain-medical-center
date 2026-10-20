import type { NextRequest } from "next/server";
import { dispatch } from "@/server/router";
import publicSite from "@/server/public";
type Ctx = { params: Promise<{ path: string[] }> };
const GET = (req: NextRequest, ctx: Ctx) => ctx.params.then((p) => dispatch(req, new URL(req.url), p.path ?? [], publicSite));
const POST = (req: NextRequest, ctx: Ctx) => ctx.params.then((p) => dispatch(req, new URL(req.url), p.path ?? [], publicSite));
export { GET, POST };
