import { cn } from "@/lib/cn";

interface BadgeProps {
  label: string;
  variant?: "default" | "success" | "warning" | "error" | "info" | "brand";
  className?: string;
}

const variants = {
  default: "bg-slate-100 text-slate-600",
  success: "bg-success-light text-success",
  warning: "bg-warning-light text-warning",
  error: "bg-error-light text-error",
  info: "bg-info-light text-info",
  brand: "bg-brand-muted text-brand",
};

export function Badge({ label, variant = "default", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold",
        variants[variant],
        className
      )}
    >
      {label}
    </span>
  );
}
