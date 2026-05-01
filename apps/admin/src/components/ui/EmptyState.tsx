import { cn } from "@/lib/cn";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-16 px-8 text-center animate-fade-in-up", className)}>
      {icon && (
        <div className="h-14 w-14 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 mb-4 [&>svg]:h-6 [&>svg]:w-6">
          {icon}
        </div>
      )}
      <p className="text-base font-semibold text-slate-900 mb-1">{title}</p>
      {description && <p className="text-sm text-slate-500 max-w-sm leading-relaxed">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
