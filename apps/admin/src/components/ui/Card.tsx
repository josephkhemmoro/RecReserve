import { cn } from "@/lib/cn";

interface CardProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  noPadding?: boolean;
  hover?: boolean;
  className?: string;
}

export function Card({ children, title, subtitle, action, noPadding, hover = false, className }: CardProps) {
  return (
    <div
      className={cn(
        "bg-card rounded-xl border border-slate-200/70 shadow-[0_1px_2px_-1px_rgba(15,23,42,0.06),0_1px_3px_rgba(15,23,42,0.06)]",
        hover && "card-hover",
        className
      )}
    >
      {(title || action) && (
        <div className="flex items-start justify-between px-6 py-4 border-b border-slate-100">
          <div className="min-w-0">
            {title && <h3 className="text-base font-semibold text-slate-900 leading-tight">{title}</h3>}
            {subtitle && <p className="text-xs text-slate-500 mt-1 leading-relaxed">{subtitle}</p>}
          </div>
          {action && <div className="flex-shrink-0 ml-4">{action}</div>}
        </div>
      )}
      <div className={cn(!noPadding && "p-6")}>{children}</div>
    </div>
  );
}
