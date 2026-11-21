import type { Metadata, Viewport } from "next";
import { Archivo, JetBrains_Mono, Noto_Sans_KR } from "next/font/google";
import { RegisterSW } from "@/components/RegisterSW";
import "./globals.css";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
});

const notoKr = Noto_Sans_KR({
  variable: "--font-noto-kr",
  weight: ["400", "500", "700", "900"],
  preload: false,
});

export const metadata: Metadata = {
  title: "WEIGHT/LOG — 다이어트 데일리 트래커",
  description: "체중 · 식단 · 운동 · 주사 · 컨디션을 하루 한 화면에 기록하는 개인용 다이어트 트래커",
  applicationName: "WEIGHT/LOG",
  // app/manifest.json is linked automatically by Next.js
  appleWebApp: {
    capable: true,
    title: "WEIGHT/LOG",
    statusBarStyle: "black",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#111111",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover", // lets the quick bar use env(safe-area-inset-bottom) on iPhone
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${archivo.variable} ${jetbrains.variable} ${notoKr.variable} h-full antialiased`}>
      <body className="min-h-full">
        {children}
        <RegisterSW />
      </body>
    </html>
  );
}
