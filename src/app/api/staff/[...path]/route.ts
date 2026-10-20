import type { NextRequest } from "next/server";
import { dispatch } from "@/server/router";
import core from "@/server/staff/core";
import clinical from "@/server/staff/clinical";
import lab from "@/server/staff/lab";
import pharmacy from "@/server/staff/pharmacy";
import billing from "@/server/staff/billing";
import ops from "@/server/staff/ops";

const table = { ...core, ...clinical, ...lab, ...pharmacy, ...billing, ...ops };
type Ctx = { params: Promise<{ path: string[] }> };
const GET = (req: NextRequest, ctx: Ctx) => ctx.params.then((p) => dispatch(req, new URL(req.url), p.path ?? [], table));
const POST = (req: NextRequest, ctx: Ctx) => ctx.params.then((p) => dispatch(req, new URL(req.url), p.path ?? [], table));
const PUT = POST;
const PATCH = POST;
export { GET, POST, PUT, PATCH };
