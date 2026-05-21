import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "QA Intelligence",
  description: "AI-powered QA analysis and test generation",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full bg-slate-900 text-slate-100 antialiased">{children}</body>
    </html>
  );
}
