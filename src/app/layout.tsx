import type { Metadata, Viewport } from "next";
import { Cairo, Tajawal, Inter, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "next-themes";
import { DirectionSync } from "@/components/shell/direction-sync";

const cairo = Cairo({ variable: "--font-cairo", subsets: ["arabic", "latin"], weight: ["400", "500", "600", "700", "800", "900"] });
const tajawal = Tajawal({ variable: "--font-tajawal", subsets: ["arabic", "latin"], weight: ["400", "500", "700", "800"] });
const inter = Inter({ variable: "--font-inter", subsets: ["latin"], weight: ["400", "600", "700", "800"] });
const plexMono = IBM_Plex_Mono({ variable: "--font-plex-mono", subsets: ["latin"], weight: ["400", "600"] });

export const metadata: Metadata = {
  title: "مركز شامل الطبي — البحرين | Shamel Medical Center",
  description:
    "النظام الصحي المتكامل لمركز شامل الطبي: موقع عام، بوابة مريض، تطبيق طاقم، كشك، شاشات انتظار، وتحقق مستندات — عربي/إنجليزي. Integrated medical center platform: EMR, LIS, pharmacy, billing, home care, CMMS.",
  keywords: ["medical center", "Bahrain", "EMR", "البحرين", "المركز الطبي", "مركز شامل", "صحي", "بحرين"],
  applicationName: "Shamel",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body
        className={`${cairo.variable} ${tajawal.variable} ${inter.variable} ${plexMono.variable} antialiased bg-background text-foreground min-h-screen`}
      >
        <ThemeProvider attribute="data-theme" defaultTheme="light" enableSystem disableTransitionOnChange>
          {children}
          <DirectionSync />
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
