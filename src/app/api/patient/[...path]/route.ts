import type { NextRequest } from "next/server";
import { dispatch } from "@/server/router";
import patient from "@/server/patient";
type Ctx = { params: Promise<{ path: string[] }> };
const GET = (req: NextRequest, ctx: Ctx) => ctx.params.then((p) => dispatch(req, new URL(req.url), p.path ?? [], patient));
const POST = (req: NextRequest, ctx: Ctx) => ctx.params.then((p) => dispatch(req, new URL(req.url), p.path ?? [], patient));
export { GET, POST };
