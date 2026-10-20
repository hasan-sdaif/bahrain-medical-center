"use client";
import { useTheme } from "next-themes";
import { Moon, Sun, Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApp } from "@/store/app";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";

export function LanguageAndTheme() {
  const { lang, setLang } = useApp();
  const { t } = useI18n();
  const { theme, setTheme } = useTheme();
  return (
    <div className="no-print sticky top-14 z-30 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto max-w-[1600px] px-3 md:px-6 h-10 flex items-center gap-2 text-xs">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5"
          onClick={() => setLang(lang === "ar" ? "en" : "ar")}
          aria-label="switch language"
        >
          <Languages className="size-3.5" aria-hidden />
          {t("shell.session.lang")}
        </Button>
        <div className="flex-1" />
        <span className="hidden md:inline text-muted-foreground">{t("shell.sim.note")}</span>
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          aria-label="toggle theme"
        >
          {theme === "dark" ? <Sun className="size-3.5" aria-hidden /> : <Moon className="size-3.5" aria-hidden />}
          {theme === "dark" ? t("shell.theme.light") : t("shell.theme.dark")}
        </Button>
      </div>
    </div>
  );
}
