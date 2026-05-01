import { cn } from "@/lib/cn";

interface BadgeProps {
  label: string;
  variant?: "default" | "success" | "warning" | "error" | "info" | "brand";
  size?: "sm" | "md";
  dot?: boolean;
  className?: string;
}

const variants = {
  default: { bg: "bg-slate-100", text: "text-slate-700", dot: "bg-slate-400", ring: "ring-slate-200" },
  success: { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500", ring: "ring-emerald-200" },
  warning: { bg: "bg-amber-50", text: "text-amber-800", dot: "bg-amber-500", ring: "ring-amber-200" },
  error: { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500", ring: "ring-red-200" },
  info: { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500", ring: "ring-blue-200" },
  brand: { bg: "bg-brand-surface", text: "text-brand-dark", dot: "bg-brand", ring: "ring-brand/20" },
} as const;

const sizes = {
  sm: "px-1.5 py-0.5 text-[10px] gap-1",
  md: "px-2 py-0.5 text-xs gap-1.5",
};

export function Badge({ label, variant = "default", size = "md", dot = false, className }: BadgeProps) {
  const v = variants[variant];
  return (
    <span
      className={cn(
        "inline-flex items-center font-medium rounded-md ring-1 ring-inset",
        v.bg,
        v.text,
        v.ring,
        sizes[size],
        className
      )}
    >
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full", v.dot)} />}
      {label}
    </span>
  );
}
