"use client";
/**
 * Shamel brand + identity primitives (from the uploaded UI guide).
 * - ShamelMark: the logo SVG (teal gradient tile, medical cross + pulse + bars)
 * - ShamelBrand: mark + name/sub lockup
 * - ShamelAccent: sets <body data-accent="…"> per portal/module so the
 *   Shamel token layer colors each workspace (guide: 01-tokens.css §accents).
 */
import { useId, useEffect } from "react";
import { useApp } from "@/store/app";
import { cn } from "@/lib/utils";

export function ShamelMark({ size = 42, className }: { size?: number; className?: string }) {
  const gid = useId().replace(/[:]/g, "");
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
      role="presentation"
    >
      <defs>
        <linearGradient id={`smc-${gid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#14B8A6" />
          <stop offset="1" stopColor="#115E59" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="14" fill={`url(#smc-${gid})`} />
      <path d="M5 14 L13 6 H13 L13 14 Z" fill="#fff" opacity=".22" />
      <path d="M5 22 L21 6 H13" fill="none" stroke="#fff" strokeOpacity=".25" strokeWidth="2" />
      <path d="M20.5 24h7v-8h-7v-7h-8v7h-7v8h7v7h8z" fill="#fff" />
      <path
        d="M28.5 24h5l2.5-6 3 12 2.5-6h6"
        stroke="#E3C866"
        strokeWidth="2.6"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <g fill="#fff">
        <rect x="8" y="34" width="3" height="6" rx="1" />
        <rect x="13" y="34" width="3" height="6" rx="1" />
        <rect x="18" y="34" width="3" height="6" rx="1" />
        <rect x="23" y="34" width="3" height="6" rx="1" />
        <rect x="28" y="34" width="3" height="6" rx="1" />
      </g>
    </svg>
  );
}

export function ShamelBrand({
  name,
  sub,
  size = 42,
  className,
  compact = false,
}: {
  name: string;
  sub?: string;
  size?: number;
  className?: string;
  compact?: boolean;
}) {
  return (
    <span className={cn("flex items-center gap-3 min-w-0", className)}>
      <ShamelMark size={size} className="shrink-0" />
      {!compact && (
        <span className="min-w-0">
          <span className="block font-[family-name:var(--font-cairo)] font-extrabold leading-tight text-[length:var(--fs-md)] text-ink truncate">
            {name}
          </span>
          {sub ? (
            <span className="block text-[length:var(--fs-xs)] text-ink-3 tracking-[0.02em] truncate">{sub}</span>
          ) : null}
        </span>
      )}
    </span>
  );
}

/** Guide accents per surface (01-tokens.css data-accent map). */
const DOMAIN_ACCENT: Record<string, string> = {
  public: "public",
  patient: "patient",
  staff: "reception", // refined by <StaffAccentBridge/> inside the staff portal
  admin: "admin",
  kiosk: "public",
  queue: "public",
  verify: "public",
};

/** Staff module → guide accent. */
export const STAFF_MODULE_ACCENT: Record<string, string> = {
  reception: "reception",
  emr: "doctor",
  lab: "lab",
  billing: "finance",
  home: "patient",
  ops: "inventory",
  admin: "admin",
};

/**
 * Sets body[data-accent] following the active domain. Staff refines it via
 * setBodyAccent(); falls back to the domain default when that module unmounts.
 */
export function setBodyAccent(accent: string) {
  if (typeof document !== "undefined") document.body.setAttribute("data-accent", accent);
}

export function ShamelAccent({ module }: { module?: string }) {
  const { domain } = useApp();
  useEffect(() => {
    const accent = module ? STAFF_MODULE_ACCENT[module] ?? DOMAIN_ACCENT[domain] : DOMAIN_ACCENT[domain];
    setBodyAccent(accent ?? "public");
    return () => {
      if (typeof document !== "undefined") document.body.removeAttribute("data-accent");
    };
  }, [domain, module]);
  return null;
}
