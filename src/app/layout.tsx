import type { Metadata, Viewport } from "next";
import { Geist, Cairo } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "next-themes";
import { DirectionSync } from "@/components/shell/direction-sync";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const cairo = Cairo({ variable: "--font-cairo", subsets: ["arabic", "latin"], weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: "المركز الطبي — البحرين | Bahrain Medical Center",
  description:
    "نظام الويب المتكامل للمركز الطبي: موقع عام، بوابة مريض، تطبيق موظفين، كشك، شاشات انتظار، وتحقق مستندات — عربي/إنجليزي. Integrated medical center platform: EMR, LIS, pharmacy, billing, home care, CMMS.",
  keywords: ["medical center", "Bahrain", "EMR", "البحرين", "المركز الطبي", "صحي", "بحرين"],
  applicationName: "BMC",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${cairo.variable} antialiased bg-background text-foreground min-h-screen`}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          {children}
          <DirectionSync />
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
