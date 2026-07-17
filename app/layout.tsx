import type { Metadata } from "next";
import { AuthProvider } from "@/components/RequireAuth";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rift — Homebuyer Roadmap",
  description: "First-time buyer readiness program and personalized homeownership roadmaps",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
