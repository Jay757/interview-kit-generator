"use client";

import React from "react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { cn } from "../lib/utils";
import { ArchitecturalBackground } from "../components/landing/ArchitecturalBackground";
import { LandingNavbar } from "../components/landing/LandingNavbar";
import { HeroSection } from "../components/landing/HeroSection";
import { ProductSimulator } from "../components/landing/simulator/ProductSimulator";
import { FeaturesBento } from "../components/landing/FeaturesBento";
import { ComparisonSection } from "../components/landing/ComparisonSection";
import { WorkflowSection } from "../components/landing/WorkflowSection";
import { FaqSection } from "../components/landing/FaqSection";
import { CtaBanner } from "../components/landing/CtaBanner";
import { LandingFooter } from "../components/landing/LandingFooter";

export default function LandingPage() {
  const { user, logout, loading: authLoading } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <div
      className={cn(
        "min-h-screen transition-colors duration-300 font-sans selection:bg-amber-500/20 selection:text-amber-400 overflow-x-hidden",
        theme === "dark" ? "bg-[#08090d] text-slate-100" : "bg-[#f8fafc] text-slate-900"
      )}
    >
      {/* Precision Vector Architectural Grid & Spotlight (No blurry blobs) */}
      <ArchitecturalBackground theme={theme} />

      {/* 1. Header & Navigation */}
      <LandingNavbar
        theme={theme}
        onToggleTheme={toggleTheme}
        user={user}
        authLoading={authLoading}
        onLogout={logout}
      />

      <main className="relative z-10">
        {/* 2. Hero Section */}
        <HeroSection theme={theme} isUserLoggedIn={!!user} />

        <div className="w-full border-t border-slate-200/70 dark:border-white/[0.06]" />

        {/* 3. Interactive Product Simulator Sandbox */}
        <ProductSimulator theme={theme} isUserLoggedIn={!!user} />

        <div className="w-full border-t border-slate-200/70 dark:border-white/[0.06]" />

        {/* 4. Core Engineering Advantages Bento Grid */}
        <FeaturesBento theme={theme} />

        <div className="w-full border-t border-slate-200/70 dark:border-white/[0.06]" />

        {/* 5. Trao vs Generic ChatGPT Comparison Matrix */}
        <ComparisonSection theme={theme} />

        <div className="w-full border-t border-slate-200/70 dark:border-white/[0.06]" />

        {/* 6. Candidate Workflow (4 Steps) */}
        <WorkflowSection theme={theme} />

        <div className="w-full border-t border-slate-200/70 dark:border-white/[0.06]" />

        {/* 7. Interactive Accordion FAQ */}
        <FaqSection theme={theme} />

        {/* 8. Conversion CTA Banner */}
        <CtaBanner theme={theme} isUserLoggedIn={!!user} />
      </main>

      {/* 9. Landing Footer */}
      <LandingFooter theme={theme} />
    </div>
  );
}
