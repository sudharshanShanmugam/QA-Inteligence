import type { Metadata } from "next";
import "./globals.css";
import MuiProvider from "@/components/MuiProvider";

export const metadata: Metadata = {
  title: "QA Intelligence",
  description: "AI-powered QA analysis and test generation",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full bg-slate-100 text-slate-900 antialiased">
        <MuiProvider>{children}</MuiProvider>
      </body>
    </html>
  );
}
