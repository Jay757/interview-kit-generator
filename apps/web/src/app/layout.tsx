import type { Metadata } from "next";
import "./globals.css";

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
      <body className="antialiased min-h-screen bg-slate-900 text-slate-100">
        {children}
      </body>
    </html>
  );
}
