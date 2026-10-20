"use client";
/**
 * Barcode/QR rendering (client) — Code 128 for operational scanning,
 * QR for document verification (verify.website.bh) only. §4.8-و
 */
import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";
import QRCode from "qrcode";
import { cn } from "@/lib/utils";

export function Code128({ value, height = 56, className, showValue = true }: { value: string; height?: number; className?: string; showValue?: boolean }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (ref.current) {
      try {
        JsBarcode(ref.current, value, {
          format: "CODE128",
          height,
          displayValue: showValue,
          fontSize: 13,
          margin: 6,
          background: "transparent",
          lineColor: "currentColor",
        });
      } catch { /* invalid value */ }
    }
  }, [value, height, showValue]);
  return <svg ref={ref} role="img" aria-label={`barcode ${value}`} className={cn("text-foreground max-w-full", className)} />;
}

export function QrCode({ value, size = 96, className }: { value: string; size?: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current) {
      QRCode.toCanvas(ref.current, value, { width: size, margin: 1 }, () => {});
    }
  }, [value, size]);
  return <canvas ref={ref} width={size} height={size} aria-label={`qr ${value}`} className={cn("rounded-md bg-white p-1", className)} />;
}
