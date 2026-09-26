import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: "#059669",
};

export const metadata: Metadata = {
  title: "장모님 절임배추 주문·출고 관리",
  description: "현장에서 쉽고 빠르게 사용하는 장모님 절임배추 주문 및 출고 관리 프로그램",
  applicationName: "절임배추관리",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "절임배추관리",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" className="h-full">
      <head>
        <link rel="manifest" href="./manifest.json" />
        <link rel="icon" href="./favicon.ico" sizes="any" />
        <link rel="icon" type="image/png" sizes="192x192" href="./icons/icon-192.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="./icons/icon-512.png" />
        <link rel="apple-touch-icon" href="./apple-touch-icon.png" />
      </head>
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900 antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
