/**
 * RBAC — spec §5.3 matrix + module gates. Server-side enforcement for every
 * staff endpoint (UI hiding is never enough).
 */
export type Module =
  | "reader" | "patients-admin" | "board" | "appointments" | "queue"
  | "triage" | "clinical" | "orders" | "lab" | "phlebotomy" | "radiology"
  | "pharmacy" | "billing" | "insurance" | "home" | "maintenance" | "inventory"
  | "quality" | "hr" | "reports" | "audit" | "settings" | "messages";

const MATRIX: Record<string, Module[]> = {
  reception: ["reader", "board", "appointments", "queue", "messages", "clinical"],
  callcenter: ["board", "appointments", "messages", "queue"],
  nurse: ["triage", "clinical", "board", "queue", "orders", "messages"],
  doctor: ["clinical", "orders", "board", "queue", "messages", "lab", "radiology", "pharmacy", "home", "reports"],
  dentist: ["clinical", "orders", "board", "radiology", "messages", "pharmacy", "reports"],
  surgeon: ["clinical", "orders", "board", "radiology", "messages", "pharmacy", "reports"],
  oncologist: ["clinical", "orders", "board", "radiology", "messages", "reports"],
  psychiatrist: ["clinical", "orders", "board", "messages", "pharmacy", "reports"],
  nutritionist: ["clinical", "orders", "board", "messages", "reports"],
  pediatrician: ["clinical", "orders", "board", "messages", "pharmacy", "reports"],
  "lab-tech": ["lab", "phlebotomy", "queue", "messages", "reports"],
  phlebotomist: ["phlebotomy", "queue", "messages"],
  radiologist: ["radiology", "queue", "messages", "reports"],
  pharmacist: ["pharmacy", "queue", "messages", "reports"],
  cashier: ["billing", "queue", "messages", "reports"],
  insurance: ["insurance", "billing", "messages", "reports"],
  collector: ["home", "messages"],
  inventory: ["inventory", "maintenance", "messages", "reports"],
  "maintenance-tech": ["maintenance", "messages"],
  "maintenance-sup": ["maintenance", "inventory", "messages", "reports"],
  hr: ["hr", "messages", "reports"],
  quality: ["quality", "reports", "messages"],
  dpo: ["audit", "quality", "reports", "messages"],
  auditor: ["audit", "reports"],
  sysadmin: ["settings", "audit", "reports", "messages"],
  content: ["messages"],
  "center-manager": ["reports", "messages", "billing", "hr", "quality", "inventory", "maintenance", "home"],
  "med-director": ["clinical", "orders", "lab", "radiology", "pharmacy", "reports", "audit", "quality", "home", "messages"],
  "dept-head": ["clinical", "orders", "reports", "queue", "messages"],
};

export function can(role: string, mod: Module): boolean {
  return (MATRIX[role] ?? []).includes(mod);
}

export function modulesFor(role: string): Module[] {
  return MATRIX[role] ?? [];
}

export const CLINICAL_VIEWERS = new Set(["doctor", "dentist", "surgeon", "oncologist", "psychiatrist", "nutritionist", "pediatrician", "nurse", "med-director", "dept-head"]);

export const SIGNERS = new Set(["doctor", "dentist", "surgeon", "oncologist", "psychiatrist", "nutritionist", "pediatrician"]);
