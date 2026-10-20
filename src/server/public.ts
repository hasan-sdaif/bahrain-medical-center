/**
 * Public website API — no medical data; limited public interface only (§3.4).
 * Guest booking with OTP; slots; catalog; articles; verification.
 */
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { problem, jo, ja } from "@/lib/api";
import { normalizeBhPhone, sha256 } from "@/lib/bahrain";
import { nextApptCode, webBookingCode } from "@/lib/numbering";
import type { RouteTable } from "./router";
import { json } from "./router";

const routes: RouteTable = {
  "GET catalog": async () => {
    const [depts, doctors, items, packages, articles, faqs, jobs, payers] = await Promise.all([
      db.department.findMany({ where: { publicVisible: true }, orderBy: { sortOrder: "asc" } }),
      db.employee.findMany({ where: { isDoctor: true, active: true }, include: { department: true } }),
      db.appointmentType.findMany({ where: { active: true, onlineBookable: true }, include: { department: true } }),
      db.package.findMany({ where: { active: true } }),
      db.article.findMany({ where: { visible: true }, orderBy: { publishedAt: "desc" }, take: 12 }),
      db.faq.findMany({ orderBy: { sortOrder: "asc" } }),
      db.jobOpening.findMany({ where: { status: "open" } }),
      db.payerCompany.findMany({ where: { active: true } }),
    ]);
    return json({
      departments: depts.map((d) => ({ code: d.code, nameAr: d.nameAr, nameEn: d.nameEn, descAr: d.descAr, descEn: d.descEn, color: d.color, icon: d.icon, prepAr: d.prepAr, prepEn: d.prepEn })),
      doctors: doctors.map((d) => ({
        id: d.id, nameAr: d.nameAr, nameEn: d.nameEn, gender: d.gender,
        deptAr: d.department?.nameAr ?? "—", deptEn: d.department?.nameEn ?? "—", deptCode: d.department?.code ?? "",
        specialtyAr: d.specialtyAr, specialtyEn: d.specialtyEn, credentialsAr: d.credentialsAr, credentialsEn: d.credentialsEn,
        languages: ja(d.languages), licenseNo: d.licenseNo, bioAr: d.bioAr, bioEn: d.bioEn,
      })),
      services: items.map((t) => ({ code: t.code, nameAr: t.nameAr, nameEn: t.nameEn, priceFils: t.priceFils, durationMin: t.durationMin, deptAr: t.department?.nameAr ?? "—", deptCode: t.department?.code ?? "", prepAr: t.instructionsAr, prepEn: t.instructionsEn, isVideo: t.isVideo, fasting: t.requiresFasting })),
      packages: packages.map((p) => ({ code: p.code, nameAr: p.nameAr, nameEn: p.nameEn, priceFils: p.priceFils, descAr: p.descAr, descEn: p.descEn, items: ja(p.items) })),
      articles: articles.map((a) => ({ slug: a.slug, titleAr: a.titleAr, titleEn: a.titleEn, category: a.category, excerpt: (a.bodyAr ?? "").slice(0, 120), publishedAt: a.publishedAt.toISOString().slice(0, 10), reviewed: a.medicalReviewed })),
      faqs: faqs.map((f) => ({ qAr: f.qAr, qEn: f.qEn, aAr: f.aAr, aEn: f.aEn })),
      jobs: jobs.map((j) => ({ titleAr: j.titleAr, titleEn: j.titleEn, dept: j.dept, openings: j.openings, descAr: j.descAr, descEn: j.descEn })),
      insurers: payers.map((p) => ({ nameAr: p.nameAr, nameEn: p.nameEn, kind: p.kind })),
    });
  },
  "GET article": async (req, url) => {
    const slug = url.searchParams.get("slug") ?? "";
    const a = await db.article.findUnique({ where: { slug } });
    if (!a) return problem("NOT_FOUND");
    return json({ slug: a.slug, titleAr: a.titleAr, titleEn: a.titleEn, bodyAr: a.bodyAr, bodyEn: a.bodyEn, category: a.category, reviewBy: a.reviewBy, publishedAt: a.publishedAt.toISOString().slice(0, 10) });
  },
  "GET slots": async (req, url) => {
    const deptCode = url.searchParams.get("dept") ?? "GP";
    const doctorId = url.searchParams.get("doctor");
    const day = Number(url.searchParams.get("day") ?? 0);
    const dept = await db.department.findUnique({ where: { code: deptCode } });
    if (!dept) return problem("NOT_FOUND");
    const base = new Date(); base.setUTCHours(0, 0, 0, 0);
    const dayStart = new Date(base.getTime() + day * 86400000 + 3 * 3600000);
    const dayEnd = new Date(dayStart.getTime() + 86400000);
    const docs = await db.employee.findMany({ where: { departmentId: dept.id, isDoctor: true, active: true, ...(doctorId ? { id: doctorId } : {}) } });
    const booked = await db.appointment.findMany({ where: { start: { gte: dayStart, lt: dayEnd }, status: { in: ["requested", "confirmed", "arrived", "in-service"] } } });
    const slots: { doctorId: string; doctorAr: string; doctorEn: string; at: string; priceFils: number }[] = [];
    for (const doc of docs) {
      for (let m = 9 * 60; m <= 19 * 60 - 30; m += 30) {
        if (m >= 13 * 60 && m < 16 * 60) continue;
        const at = new Date(dayStart.getTime() + m * 60000);
        if (at < new Date(Date.now() + 2 * 3600000)) continue;
        const end = new Date(at.getTime() + 30 * 60000);
        if (booked.some((b) => (b.employeeId ?? "") === doc.id && b.start < end && b.end > at)) continue;
        slots.push({ doctorId: doc.id, doctorAr: doc.nameAr, doctorEn: doc.nameEn, at: at.toISOString(), priceFils: 15000 });
      }
    }
    await audit({ action: "view-slots", resource: "public", after: { dept: deptCode, slots: slots.length } });
    return json({ date: dayStart.toISOString().slice(0, 10), slots: slots.slice(0, 30) });
  },
  // Guest booking: step 1 — request + OTP
  "POST booking/request": async (req) => {
    const b = jo(await req.json()) as { nameAr?: string; phone?: string; slot?: string; doctorId?: string; deptCode?: string };
    const tel = normalizeBhPhone(String(b.phone ?? ""));
    if (!tel.ok) return problem("PHONE_INVALID_BH");
    if (!b.nameAr || !b.slot) return problem("VALIDATION");
    const code = webBookingCode();
    const otp = String(Math.floor(Math.random() * 9000 + 1000));
    const wb = await db.webBooking.create({
      data: { code, nameAr: b.nameAr, phone: tel.e164, slot: new Date(b.slot), doctorId: b.doctorId ?? null, departmentCode: b.deptCode ?? "GP", status: "pending-otp", otpHash: sha256(otp).slice(0, 16) } as never,
    });
    await audit({ action: "booking-request", resource: "web-booking", resourceId: wb.id, after: { code } });
    return json({ id: wb.id, code, otpDemo: otp, noteAr: "رمز التحقق أُرسل رسالة (وضع تجريبي يظهره مباشرة)", noteEn: "OTP sent by SMS (demo shows it inline)" }, 201);
  },
  // step 2 — verify OTP → create/find patient + appointment requested
  "POST booking/verify": async (req) => {
    const b = jo(await req.json()) as { bookingId?: string; otp?: string; idNumber?: string; idType?: string };
    const wb = await db.webBooking.findUnique({ where: { id: String(b.bookingId) } });
    if (!wb || !wb.slot) return problem("NOT_FOUND");
    if (sha256(String(b.otp ?? "")).slice(0, 16) !== (wb as { otpHash?: string }).otpHash) return problem("VALIDATION", { detail: "OTP mismatch", code: "OTP_INVALID" }, 401);
    // find by phone; else create low-assurance patient
    let patient = await db.patient.findFirst({ where: { phone: wb.phone } });
    if (!patient) {
      const mrn = `P26-${String(900000 + Math.floor(Math.random() * 999)).padStart(7, "0")}`;
      const mrnChecked = `${mrn}-${await (async () => 7)()}`;
      patient = await db.patient.create({
        data: { mrn: mrnChecked, assurance: 3, firstNameAr: wb.nameAr.split(" ")[0] ?? wb.nameAr, familyAr: wb.nameAr.split(" ").slice(1).join(" ") || "—", firstNameEn: wb.nameAr, familyEn: wb.nameAr, phone: wb.phone, dob: new Date("1990-01-01"), gender: "male", nationality: "غير محدد" },
      });
    }
    const dept = await db.department.findUnique({ where: { code: (wb as { departmentCode?: string }).departmentCode ?? "GP" } });
    const code = await nextApptCode();
    const appt = await db.appointment.create({
      data: { code, patientId: patient.id, departmentId: dept!.id, employeeId: (wb as { doctorId?: string }).doctorId, appointmentTypeId: (await db.appointmentType.findFirst({ where: { code: "GP-NEW" } }))!.id, start: wb.slot, end: new Date(wb.slot.getTime() + 30 * 60000), status: "requested", channel: "web", priceFils: 15000, createdBy: "web-guest" },
    });
    await db.webBooking.update({ where: { id: wb.id }, data: { status: "converted" } as never });
    await audit({ action: "book-guest", resource: "appointment", resourceId: appt.id, patientId: patient.id, after: { code, via: wb.code } });
    return json({ appointment: { id: appt.id, code, start: appt.start.toISOString() }, patient: { mrn: patient.mrn, nameAr: `${patient.firstNameAr} ${patient.familyAr}` }, noteAr: "سيتم تأكيد الموعد بعد اتصال مركز الاتصال — رقمنا +973 1750 0000", noteEn: "Call-center will confirm — +973 1750 0000" }, 201);
  },
  "POST contact": async (req) => {
    const b = jo(await req.json()) as { nameAr?: string; phone?: string; message?: string; category?: string };
    if (!b.nameAr || !b.message) return problem("VALIDATION");
    const c = await db.complaint.create({ data: { code: `CMP-${Date.now().toString(36).toUpperCase()}`, channel: "web", category: b.category ?? "general", description: `${b.message} — من: ${b.nameAr} (${b.phone ?? "بلا هاتف"})`, status: "received" } });
    await db.task.create({ data: { titleAr: `شكوى/تواصل جديد ${c.code}`, role: "quality", status: "new", kind: "complaint", refType: "complaint", refId: c.id, dueAt: new Date(Date.now() + 3 * 86400000) } });
    return json({ tracking: c.code, slaAr: "رد خلال 3 أيام عمل", slaEn: "Reply within 3 working days" }, 201);
  },
  "POST verify-code": async (req) => {
    const b = jo(await req.json()) as { code?: string };
    const code = (b.code ?? "").trim().toUpperCase();
    const doc = await db.document.findUnique({ where: { verifyCode: code } });
    if (!doc || doc.revokedAt) return json({ valid: false });
    await audit({ action: "verify-doc", resource: "document", resourceId: doc.id, after: { code } });
    return json({
      valid: true, kind: doc.kind, issuedAt: doc.issuedAt.toISOString().slice(0, 10),
      doctorNameAr: (await db.employee.findUnique({ where: { id: doc.issuedBy ?? "" } }))?.nameAr ?? "—",
      doctorLicense: (await db.employee.findUnique({ where: { id: doc.issuedBy ?? "" } }))?.licenseNo ?? "—",
      titleAr: doc.titleAr, titleEn: doc.titleEn,
    });
  },
};
void nextApptCode;
export default routes;
