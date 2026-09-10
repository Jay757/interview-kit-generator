import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "../context/AuthContext";

export const metadata: Metadata = {
  title: "Trao — AI Interview Prep Kit",
  description:
    "Personalized interview preparation kits generated from job descriptions and company intelligence.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen bg-[#090a0f] text-slate-100">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
