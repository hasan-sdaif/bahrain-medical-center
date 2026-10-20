import type { NextRequest } from "next/server";
import { dispatch } from "@/server/router";
import fhir from "@/server/fhir";
type Ctx = { params: Promise<{ path: string[] }> };
const GET = (req: NextRequest, ctx: Ctx) => ctx.params.then((p) => dispatch(req, new URL(req.url), p.path ?? [], fhir));
export { GET };
