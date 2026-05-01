interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  eyebrow?: string;
}

export function PageHeader({ title, subtitle, action, eyebrow }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-6 mb-8 animate-fade-in">
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-[11px] font-bold text-brand uppercase tracking-widest mb-1.5">{eyebrow}</p>
        )}
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight leading-tight">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 mt-1.5 max-w-2xl">{subtitle}</p>}
      </div>
      {action && <div className="flex-shrink-0 flex items-center gap-2">{action}</div>}
    </div>
  );
}
