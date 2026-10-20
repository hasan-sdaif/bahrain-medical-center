import { cn } from "@/lib/utils";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/toaster";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      {children}
      <Toaster />
    </ThemeProvider>
  );
}

export function DirectionSync({ dir, lang }: { dir: "rtl" | "ltr"; lang: string }) {
  return <span className={cn("hidden")} data-dir={dir} data-lang={lang} aria-hidden />;
}
