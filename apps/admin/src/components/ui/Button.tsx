"use client";

import { cn } from "@/lib/cn";

interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline";
  size?: "sm" | "md" | "lg" | "icon";
  icon?: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
  type?: "button" | "submit";
  fullWidth?: boolean;
  className?: string;
}

const variants = {
  primary:
    "bg-brand text-white shadow-sm shadow-brand/20 hover:bg-brand-dark hover:shadow-md hover:shadow-brand/30 focus-visible:ring-brand",
  secondary:
    "bg-white text-slate-900 border border-slate-200 shadow-sm hover:bg-slate-50 hover:border-slate-300 focus-visible:ring-slate-300",
  outline:
    "bg-transparent text-brand border border-brand/40 hover:bg-brand-surface hover:border-brand focus-visible:ring-brand",
  ghost:
    "text-slate-600 hover:text-slate-900 hover:bg-slate-100 focus-visible:ring-slate-300",
  danger:
    "bg-red-600 text-white shadow-sm shadow-red-600/20 hover:bg-red-700 hover:shadow-md hover:shadow-red-600/30 focus-visible:ring-red-500",
};

const sizes = {
  sm: "px-3 py-1.5 text-xs gap-1.5 rounded-md",
  md: "px-4 py-2 text-sm gap-2 rounded-lg",
  lg: "px-5 py-2.5 text-sm gap-2 rounded-lg",
  icon: "h-9 w-9 rounded-lg",
};

export function Button({
  children,
  onClick,
  variant = "primary",
  size = "md",
  icon,
  loading = false,
  disabled = false,
  type = "button",
  fullWidth = false,
  className,
}: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        "btn-press inline-flex items-center justify-center font-semibold cursor-pointer select-none whitespace-nowrap",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
        "disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none",
        variants[variant],
        sizes[size],
        fullWidth && "w-full",
        className
      )}
    >
      {loading ? (
        <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current/30 border-t-current" />
      ) : icon ? (
        <span className="flex items-center [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
      ) : null}
      {children}
    </button>
  );
}
