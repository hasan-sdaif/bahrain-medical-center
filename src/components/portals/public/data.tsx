"use client";
/**
 * Public portal data layer — catalog fetch + shared DTO types + department
 * icon mapping (icons come from the API as lucide names).
 */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { apiGet } from "@/lib/api-client";
import {
  Activity, Apple, Baby, Brain, Droplets, Heart, Ribbon, Scissors, Smile, Stethoscope, type LucideIcon,
} from "lucide-react";

export interface DeptDto { code: string; nameAr: string; nameEn: string; descAr: string; descEn: string; color: string; icon: string; prepAr: string | null; prepEn: string | null }
export interface DoctorDto {
  id: string; nameAr: string; nameEn: string; gender: string; deptAr: string; deptEn: string; deptCode: string;
  specialtyAr: string | null; specialtyEn: string | null; credentialsAr: string | null; credentialsEn: string | null;
  languages: string[]; licenseNo: string | null; bioAr: string | null; bioEn: string | null;
}
export interface ServiceDto { code: string; nameAr: string; nameEn: string; priceFils: number; durationMin: number; deptAr: string; deptCode: string; prepAr: string | null; prepEn: string | null; isVideo: boolean; fasting: boolean }
export interface PkgDto { code: string; nameAr: string; nameEn: string; priceFils: number; descAr: string | null; descEn: string | null; items: unknown[] }
export interface ArticleSummaryDto { slug: string; titleAr: string; titleEn: string; category: string; excerpt: string; publishedAt: string; reviewed: boolean }
export interface FaqDto { qAr: string; qEn: string; aAr: string; aEn: string }
export interface JobDto { titleAr: string; titleEn: string; dept: string; openings: number; descAr: string | null; descEn: string | null }
export interface InsurerDto { nameAr: string; nameEn: string; kind: string }

export interface CatalogDto {
  departments: DeptDto[]; doctors: DoctorDto[]; services: ServiceDto[]; packages: PkgDto[];
  articles: ArticleSummaryDto[]; faqs: FaqDto[]; jobs: JobDto[]; insurers: InsurerDto[];
}

export const EMPTY_CATALOG: CatalogDto = { departments: [], doctors: [], services: [], packages: [], articles: [], faqs: [], jobs: [], insurers: [] };

interface CatalogCtx { data: CatalogDto; loading: boolean; error: string | null; reload: () => void }
const Ctx = createContext<CatalogCtx | null>(null);

export function PublicDataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<CatalogDto>(EMPTY_CATALOG);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    apiGet<CatalogDto>("/api/public/catalog")
      .then((d) => { if (alive) setData(d); })
      .catch((e: unknown) => {
        if (!alive) return;
        const p = (e as { problem?: Record<string, unknown> }).problem;
        setError((p?.detail as string) ?? "catalog");
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return <Ctx.Provider value={{ data, loading, error, reload }}>{children}</Ctx.Provider>;
}

export function usePublicData(): CatalogCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("usePublicData outside provider");
  return c;
}

/** Bilingual detail from an RFC7807 problem, falling back to a generic key. */
export function problemDetail(e: unknown, lang: "ar" | "en"): string | null {
  const p = (e as { problem?: Record<string, unknown> })?.problem;
  if (!p) return null;
  const ar = p.detailAr as string | undefined;
  const en = p.detailEn as string | undefined;
  return (lang === "ar" ? ar ?? en : en ?? ar) ?? null;
}

const DEPT_ICONS: Record<string, LucideIcon> = {
  stethoscope: Stethoscope, smile: Smile, scissors: Scissors, activity: Activity,
  heart: Heart, droplets: Droplets, ribbon: Ribbon, apple: Apple, baby: Baby, brain: Brain,
};

export function deptIcon(name?: string | null): LucideIcon {
  return DEPT_ICONS[name ?? ""] ?? Stethoscope;
}

/** Client-side Bahraini phone check (mirrors server normalizeBhPhone rules). */
export function bhPhoneLocal(input: string): string | null {
  const digits = (input ?? "").replace(/[^\d]/g, "");
  const local = digits.startsWith("973") ? digits.slice(3) : digits;
  return /^[36789]\d{7}$/.test(local) ? local : null;
}
