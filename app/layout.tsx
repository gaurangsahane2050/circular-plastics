import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Circular Plastics Exchange",
  description: "Sort, pick up and trace plastic waste from societies, campuses and shops",
  appleWebApp: { capable: true, title: "Circular Plastics", statusBarStyle: "default" },
};

// viewportFit "cover" lets the bottom tab bar sit above the phone's home indicator
export const viewport: Viewport = { themeColor: "#047857", viewportFit: "cover" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-slate-50 font-sans text-slate-900 antialiased">{children}</body>
    </html>
  );
}
