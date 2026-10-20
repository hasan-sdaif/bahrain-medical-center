"use client";
import { useEffect } from "react";
import { useApp } from "@/store/app";

/** Keeps <html dir/lang> in sync with the selected language (ar/rtl ↔ en/ltr). */
export function DirectionSync() {
  const lang = useApp((s) => s.lang);
  useEffect(() => {
    const html = document.documentElement;
    html.lang = lang;
    html.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);
  return null;
}
