/**
 * Global client state — session, domain switching, reader status.
 * (Zustand; server state via TanStack Query.)
 */
"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type DomainKey = "public" | "patient" | "staff" | "admin" | "kiosk" | "queue" | "verify";

export interface StaffSession {
  employeeId: string;
  role: string;
  nameAr: string;
  nameEn: string;
  departmentId?: string | null;
}
export interface PatientSession {
  patientId: string;
  mrn: string;
  nameAr: string;
  nameEn: string;
}

interface AppState {
  lang: "ar" | "en";
  domain: DomainKey;
  staff: StaffSession | null;
  patient: PatientSession | null;
  readerOnline: boolean;
  setLang: (l: "ar" | "en") => void;
  setDomain: (d: DomainKey) => void;
  setStaff: (s: StaffSession | null) => void;
  setPatient: (p: PatientSession | null) => void;
  setReaderOnline: (v: boolean) => void;
}

export const useApp = create<AppState>()(
  persist(
    (set) => ({
      lang: "ar",
      domain: "public",
      staff: null,
      patient: null,
      readerOnline: true,
      setLang: (l) => set({ lang: l }),
      setDomain: (d) => set({ domain: d }),
      setStaff: (s) => set({ staff: s }),
      setPatient: (p) => set({ patient: p }),
      setReaderOnline: (v) => set({ readerOnline: v }),
    }),
    { name: "bmc-app" },
  ),
);

export const DOMAINS: { key: DomainKey; host: string }[] = [
  { key: "public", host: "website.bh" },
  { key: "patient", host: "patient.website.bh" },
  { key: "staff", host: "staff.website.bh" },
  { key: "admin", host: "admin.website.bh" },
  { key: "kiosk", host: "kiosk.website.bh" },
  { key: "queue", host: "queue.website.bh" },
  { key: "verify", host: "verify.website.bh" },
];
