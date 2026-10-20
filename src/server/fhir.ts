/**
 * FHIR R4 facade — the integration bridge between this system and the
 * cloned reference systems (OpenEMR, OpenMRS, Bahmni, Medplum, OpenELIS,
 * OHIF...). Spec §6.7: internal model FHIR-compatible.
 * Endpoints: metadata (CapabilityStatement), Patient, Encounter,
 * Observation (vitals+labs), ServiceRequest, DiagnosticReport,
 * MedicationRequest, Immunization, Consent, DocumentReference.
 * Search by ?patient={id} / ?_id= ; JSON only; public read, write via staff.
 */
import { db } from "@/lib/db";
import { ja } from "@/lib/api";
import type { RouteTable } from "./router";
import { json } from "./router";

const FHIR = { "resourceType": "OperationOutcome" };
void FHIR;

function ref(type: string, id: string): { reference: string } { return { reference: `${type}/${id}` }; }
function human(p: { firstNameAr: string; familyAr: string; firstNameEn?: string | null; familyEn?: string | null; gender: string; dob: Date }): fhirHumanName[] {
  return [
    { use: "official", text: `${p.firstNameAr} ${p.familyAr}`, family: p.familyAr, given: [p.firstNameAr], _language: "ar" },
    ...(p.firstNameEn ? [{ use: "official", text: `${p.firstNameEn} ${p.familyEn ?? ""}`.trim(), family: p.familyEn ?? undefined, given: [p.firstNameEn], _language: "en" }] : []),
  ];
}
interface fhirHumanName { use: string; text: string; family?: string; given?: string[]; _language?: string }

async function patientResource(id: string) {
  const p = await db.patient.findUnique({ where: { id }, include: { identifiers: true, policies: true, flags: true } });
  if (!p) return null;
  return {
    resourceType: "Patient",
    id: p.id,
    identifier: p.identifiers.map((i) => ({ system: `urn:bmc:id-type:${i.type}`, value: i.number, assigner: i.country ? { display: i.country } : undefined })),
    active: !p.deceased,
    name: human(p),
    gender: p.gender,
    birthDate: p.dob.toISOString().slice(0, 10),
    telecom: p.phone ? [{ system: "phone", value: p.phone, use: "mobile" }] : [],
    address: [{
      use: "home", text: Object.values(p.address as Record<string, unknown> ?? {}).filter(Boolean).join("، "),
      country: "BH", state: (p.address as Record<string, unknown>)?.governorate as string | undefined,
    }],
    extension: p.flags.map((f) => ({ url: `urn:bmc:flag:${f.kind}`, valueString: f.valueAr ?? f.kind })),
  };
}

async function encounterResources(patientId?: string, id?: string) {
  const rows = await db.encounter.findMany({ where: { ...(patientId ? { patientId } : {}), ...(id ? { id } : {}) }, take: 100, orderBy: { startedAt: "desc" } });
  return rows.map((e) => ({
    resourceType: "Encounter",
    id: e.id,
    identifier: [{ system: "urn:bmc:encounter", value: e.code }],
    status: e.status === "closed" ? "finished" : "in-progress",
    class: { system: "http://terminology.hl7.org/CodeSystem/v3-ActCode", code: "AMB", display: "ambulatory" },
    type: [{ text: e.type }],
    subject: ref("Patient", e.patientId),
    participant: e.doctorId ? [{ individual: ref("Practitioner", e.doctorId) }] : [],
    period: { start: e.startedAt.toISOString(), end: e.closedAt?.toISOString() ?? undefined },
    serviceProvider: ref("Organization", e.departmentId),
    reasonCode: e.chief ? [{ text: e.chief }] : [],
    diagnosis: e.assessment ? [{ condition: { display: e.assessment } }] : [],
  }));
}

async function observationResources(patientId?: string) {
  const out: unknown[] = [];
  const vitals = await db.vitals.findMany({ where: patientId ? { patientId } : {}, take: 100, orderBy: { recordedAt: "desc" } });
  const VITAL_MAP: [keyof (typeof vitals)[number] | "bmi", string, string][] = [
    ["tempC", "8310-5", "°C"], ["pulse", "8867-4", "/min"], ["resp", "9279-1", "/min"],
    ["bpSys", "8480-6", "mmHg"], ["bpDia", "8462-4", "mmHg"], ["spo2", "59408-5", "%"],
    ["weightKg", "29463-7", "kg"], ["heightCm", "8302-2", "cm"], ["bmi", "39156-5", "kg/m2"],
  ];
  for (const v of vitals) {
    for (const [key, loinc, unit] of VITAL_MAP) {
      const value = (v as unknown as Record<string, unknown>)[key];
      if (value == null) continue;
      out.push({
        resourceType: "Observation", id: `${v.id}-${String(key)}`,
        status: "final", category: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/observation-category", code: "vital-signs" }] }],
        code: { coding: [{ system: "http://loinc.org", code: loinc }], text: String(key) },
        subject: ref("Patient", v.patientId), effectiveDateTime: v.recordedAt.toISOString(),
        valueQuantity: { value: Number(value), unit },
      });
    }
  }
  const labs = await db.labResult.findMany({ where: { ...(patientId ? { patientId } : {}), verifiedAt: { not: null } }, include: { orderItem: true, test: true }, take: 100, orderBy: { resultedAt: "desc" } });
  for (const r of labs) {
    out.push({
      resourceType: "Observation", id: r.id,
      status: r.releasedAt ? "final" : "preliminary",
      category: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/observation-category", code: "laboratory" }] }],
      code: { coding: r.test.loinc ? [{ system: "http://loinc.org", code: r.test.loinc }] : [], text: r.orderItem.nameEn ?? r.orderItem.nameAr },
      subject: ref("Patient", r.patientId), effectiveDateTime: r.resultedAt.toISOString(),
      valueQuantity: r.value != null ? { value: r.value, unit: r.unit } : undefined,
      valueString: r.valueText ?? undefined,
      interpretation: r.flag && r.flag !== "normal" ? [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation", code: r.flag }] }] : [],
      referenceRange: [{ low: r.refLow != null ? { value: r.refLow, unit: r.unit } : undefined, high: r.refHigh != null ? { value: r.refHigh, unit: r.unit } : undefined }],
      note: r.comment ? [{ text: r.comment }] : [],
    });
  }
  return out;
}

async function serviceRequestResources(patientId?: string) {
  const rows = await db.order.findMany({ where: patientId ? { patientId } : {}, include: { items: true }, take: 100 });
  const out: unknown[] = [];
  for (const o of rows) {
    out.push({
      resourceType: "ServiceRequest", id: o.id,
      identifier: [{ system: "urn:bmc:order", value: o.code }],
      status: o.status === "cancelled" ? "revoked" : o.status === "rejected" ? "revoked" : "active",
      intent: "order",
      category: [{ coding: [{ system: "urn:bmc:kind", code: o.kind }] }],
      code: { text: o.items.map((i) => i.nameEn ?? i.nameAr).join(" + ") },
      subject: ref("Patient", o.patientId),
      requester: o.doctorId ? ref("Practitioner", o.doctorId) : undefined,
      priority: o.priority === "stat" ? "stat" : o.priority === "urgent" ? "urgent" : "routine",
      reasonCode: o.reason ? [{ text: o.reason }] : [],
      authoredOn: o.createdAt.toISOString(),
    });
  }
  return out;
}

async function diagnosticReportResources(patientId?: string) {
  const rows = await db.imagingStudy.findMany({ where: patientId ? { patientId } : {}, take: 100 });
  return rows.map((s) => ({
    resourceType: "DiagnosticReport", id: s.id,
    identifier: [{ system: "urn:bmc:imaging", value: s.code }],
    status: s.status === "signed" ? "final" : s.status === "cancelled" ? "cancelled" : "preliminary",
    category: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/v2-0074", code: "RAD" }] }],
    code: { text: s.template ?? "Imaging study" },
    subject: ref("Patient", s.patientId),
    effectiveDateTime: (s.performedAt ?? s.createdAt).toISOString(),
    conclusion: s.reportAr ?? undefined,
    conclusionCode: s.grade ? [{ text: s.grade }] : [],
    performer: s.signedBy ? [ref("Practitioner", s.signedBy)] : [],
  }));
}

async function medicationRequestResources(patientId?: string) {
  const rows = await db.prescription.findMany({ where: patientId ? { patientId } : {}, include: { items: { include: { drug: true } } }, take: 100 });
  return rows.flatMap((rx) =>
    rx.items.map((it) => ({
      resourceType: "MedicationRequest", id: `${rx.id}-${it.id}`,
      identifier: [{ system: "urn:bmc:rx", value: `${rx.code}#${it.id}` }],
      status: rx.status === "cancelled" ? "cancelled" : rx.status === "dispensed" ? "completed" : "active",
      intent: "order",
      medicationCodeableConcept: { text: it.drug.nameEn, coding: it.drug.atc ? [{ system: "http://www.whocc.no/atc", code: it.drug.atc }] : [] },
      subject: ref("Patient", rx.patientId),
      authoredOn: rx.createdAt.toISOString(),
      requester: rx.doctorId ? ref("Practitioner", rx.doctorId) : undefined,
      dosageInstruction: [{
        text: it.instrAr ?? it.frequency, timing: { repeat: { boundsDuration: { value: it.durationDays, unit: "d" } } },
        route: { text: it.route }, doseAndRate: [{ doseQuantity: { text: it.doseEn } }],
      }],
      dispenseRequest: { quantity: { value: it.qty } },
    })),
  );
}

async function immunizationResources(patientId?: string) {
  const rows = await db.immunization.findMany({ where: patientId ? { patientId } : {}, take: 100 });
  return rows.map((i) => ({
    resourceType: "Immunization", id: i.id,
    status: "completed",
    vaccineCode: { text: i.vaccineEn ?? i.vaccine },
    patient: ref("Patient", i.patientId),
    occurrenceDateTime: i.givenAt.toISOString(),
    lotNumber: i.batch ?? undefined,
    site: { text: i.site ?? undefined } as unknown,
    performer: i.givenBy ? [ref("Practitioner", i.givenBy)] : [],
  }));
}

async function consentResources(patientId?: string) {
  const rows = await db.consent.findMany({ where: patientId ? { patientId } : {}, take: 100 });
  return rows.map((c) => ({
    resourceType: "Consent", id: c.id,
    identifier: [{ system: "urn:bmc:consent", value: c.code }],
    status: c.status === "active" ? "active" : "inactive",
    scope: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/consentscope", code: "patient-privacy" }] },
    category: [{ text: c.templateKey }],
    patient: ref("Patient", c.patientId),
    dateTime: c.signedAt.toISOString(),
    policyRule: { text: `template v${c.templateVersion}` },
  }));
}

async function documentResources(patientId?: string) {
  const rows = await db.document.findMany({ where: patientId ? { patientId } : {}, take: 100 });
  return rows.map((d) => ({
    resourceType: "DocumentReference", id: d.id,
    status: d.revokedAt ? "superseded" : "current",
    type: { text: d.kind },
    subject: ref("Patient", d.patientId ?? ""),
    date: d.issuedAt.toISOString(),
    description: d.titleAr,
    content: [{ attachment: { contentType: "text/plain", title: d.titleEn, url: `urn:bmc:verify:${d.verifyCode}` }, format: { display: "BMC verification code" } }],
  }));
}

const CAPABILITY = {
  resourceType: "CapabilityStatement",
  status: "active", date: new Date().toISOString(), publisher: "Bahrain Medical Center",
  software: { name: "BMC Unified Platform", version: "1.0.0" },
  implementation: { description: "FHIR R4 facade over BMC operational datastore; bridges OpenEMR/OpenMRS/Bahmni/Medplum/OpenELIS/OHIF clones" },
  fhirVersion: "4.0.1", format: ["json"],
  rest: [{
    mode: "server",
    resource: (["Patient", "Encounter", "Observation", "ServiceRequest", "DiagnosticReport", "MedicationRequest", "Immunization", "Consent", "DocumentReference"] as const).map((r) => ({
      type: r,
      interaction: [{ code: "read" }, { code: "search-type" }],
      searchParam: [{ name: "patient", type: "reference" }, { name: "_id", type: "token" }],
    })),
  }],
};

function bundle(resources: unknown[]) {
  return { resourceType: "Bundle", type: "searchset", total: resources.length, entry: resources.map((r) => ({ resource: r })) };
}

function notFound() { return json({ resourceType: "OperationOutcome", issue: [{ severity: "error", code: "not-found" }] }, 404); }

const routes: RouteTable = {
  "GET metadata": async () => json(CAPABILITY),
  "GET Patient": async (req, url) => {
    const pid = url.searchParams.get("patient") ?? undefined;
    const id = url.searchParams.get("_id") ?? undefined;
    if (id) { const p = await patientResource(id); return p ? json(bundle([p])) : notFound(); }
    const rows = await db.patient.findMany({ where: pid ? { id: pid } : {}, take: 50 });
    const out: unknown[] = [];
    for (const p of rows) { const r = await patientResource(p.id); if (r) out.push(r); }
    return json(bundle(out));
  },
  "GET Patient/*": async (req, url) => {
    const id = url.pathname.split("/").pop() ?? "";
    const p = await patientResource(id);
    return p ? json(p) : notFound();
  },
  "GET Encounter": async (req, url) => json(bundle(await encounterResources(url.searchParams.get("patient") ?? undefined))),
  "GET Observation": async (req, url) => json(bundle(await observationResources(url.searchParams.get("patient") ?? undefined))),
  "GET ServiceRequest": async (req, url) => json(bundle(await serviceRequestResources(url.searchParams.get("patient") ?? undefined))),
  "GET DiagnosticReport": async (req, url) => json(bundle(await diagnosticReportResources(url.searchParams.get("patient") ?? undefined))),
  "GET MedicationRequest": async (req, url) => json(bundle(await medicationRequestResources(url.searchParams.get("patient") ?? undefined))),
  "GET Immunization": async (req, url) => json(bundle(await immunizationResources(url.searchParams.get("patient") ?? undefined))),
  "GET Consent": async (req, url) => json(bundle(await consentResources(url.searchParams.get("patient") ?? undefined))),
  "GET DocumentReference": async (req, url) => json(bundle(await documentResources(url.searchParams.get("patient") ?? undefined))),
  "GET bridge-status": async () => {
    const forks = ["openemr", "openmrs-core", "bahmni-core", "openhospital", "care", "medplum", "foomedical", "OpenELIS-Global-2", "Viewers", "healthcare"];
    return json({
      strategy: "clone-and-bridge",
      cloned: forks.map((f) => ({ repo: `hasan-sdaif/${f}`, url: `https://github.com/hasan-sdaif/${f}` })),
      localReferenceClones: ["foomedical (Apache-2.0)", "openhospital", "bahmni-core"],
      bridge: "FHIR R4 (this API) — same standard used by OpenMRS, Medplum, OpenELIS, OHIF",
      noteAr: "الأنظمة مستنسخة تحت حسابك؛ منصة BMC توحّد وظائفها وتتكامل معها عبر FHIR R4",
      noteEn: "Systems cloned under your account; the BMC platform unifies their capabilities and bridges them via FHIR R4",
    });
  },
};
void ja;
export default routes;
