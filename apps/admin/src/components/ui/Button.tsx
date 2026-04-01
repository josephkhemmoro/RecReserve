"use client";

import { cn } from "@/lib/cn";

interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  icon?: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
  type?: "button" | "submit";
  fullWidth?: boolean;
  className?: string;
}

const variants = {
  primary: "bg-brand text-white hover:bg-brand-dark shadow-sm",
  secondary: "bg-white text-brand border border-brand/30 hover:bg-brand-surface",
  ghost: "text-slate-600 hover:text-slate-900 hover:bg-slate-100",
  danger: "bg-error-light text-error border border-red-200 hover:bg-red-100",
};

const sizes = {
  sm: "px-3 py-1.5 text-xs gap-1.5",
  md: "px-4 py-2 text-sm gap-2",
  lg: "px-5 py-2.5 text-sm gap-2",
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
        "inline-flex items-center justify-center font-medium rounded-lg transition-colors cursor-pointer",
        variants[variant],
        sizes[size],
        fullWidth && "w-full",
        (disabled || loading) && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      {loading ? (
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-current/30 border-t-current" />
      ) : icon ? (
        icon
      ) : null}
      {children}
    </button>
  );
}
