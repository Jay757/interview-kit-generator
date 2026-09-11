"use client";

import React, { useEffect } from "react";
import Link from "next/link";

export interface ToastProps {
  id?: string;
  type?: "error" | "warning" | "info" | "success";
  badge?: string;
  title: string;
  message: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  secondaryAction?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  duration?: number; // 0 for persistent
  onClose: () => void;
}

export function Toast({
  type = "error",
  badge,
  title,
  message,
  action,
  secondaryAction,
  duration = 0,
  onClose,
}: ToastProps) {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const isError = type === "error";
  const isWarning = type === "warning";
  const isSuccess = type === "success";

  const borderColor = isError
    ? "border-rose-500/40 dark:border-rose-500/40"
    : isWarning
    ? "border-amber-500/40 dark:border-amber-500/40"
    : isSuccess
    ? "border-emerald-500/40 dark:border-emerald-500/40"
    : "border-blue-500/40 dark:border-blue-500/40";

  const badgeBg = isError
    ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
    : isWarning
    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
    : isSuccess
    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
    : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20";

  const icon = isError ? "⚠️" : isWarning ? "⚡" : isSuccess ? "✓" : "ℹ️";

  return (
    <div
      role="alert"
      className={`fixed bottom-6 right-6 z-50 max-w-md w-full sm:w-[440px] p-5 rounded-3xl bg-white/95 dark:bg-[#0e1324]/95 backdrop-blur-2xl border ${borderColor} shadow-2xl shadow-rose-500/10 dark:shadow-black/50 transition-all transform animate-in slide-in-from-bottom-5 duration-300`}
    >
      <div className="flex items-start gap-3.5">
        <div className="flex-shrink-0 w-10 h-10 rounded-2xl bg-rose-500/10 dark:bg-rose-500/20 flex items-center justify-center text-lg">
          {icon}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {badge && (
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${badgeBg}`}>
                {badge}
              </span>
            )}
            <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
              {title}
            </h4>
          </div>

          <p className="text-xs text-slate-600 dark:text-zinc-300 leading-relaxed break-words">
            {message}
          </p>

          {(action || secondaryAction) && (
            <div className="flex items-center gap-2.5 mt-3 pt-3 border-t border-slate-200/60 dark:border-white/[0.08]">
              {action && (
                action.href ? (
                  <Link
                    href={action.href}
                    className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-sm transition-all"
                  >
                    {action.label}
                  </Link>
                ) : (
                  <button
                    onClick={action.onClick}
                    className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-sm transition-all"
                  >
                    {action.label}
                  </button>
                )
              )}

              {secondaryAction && (
                secondaryAction.href ? (
                  <Link
                    href={secondaryAction.href}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.1] text-slate-700 dark:text-zinc-300 text-xs font-semibold transition-all"
                  >
                    {secondaryAction.label}
                  </Link>
                ) : (
                  <button
                    onClick={secondaryAction.onClick}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.1] text-slate-700 dark:text-zinc-300 text-xs font-semibold transition-all"
                  >
                    {secondaryAction.label}
                  </button>
                )
              )}
            </div>
          )}
        </div>

        <button
          onClick={onClose}
          aria-label="Dismiss message"
          className="flex-shrink-0 text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-colors"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
