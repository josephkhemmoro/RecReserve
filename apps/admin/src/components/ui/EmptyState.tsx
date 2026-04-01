interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-8">
      {icon && <div className="text-slate-300 mb-4">{icon}</div>}
      <p className="text-base font-medium text-slate-700 mb-1">{title}</p>
      {description && <p className="text-sm text-slate-400 text-center max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
