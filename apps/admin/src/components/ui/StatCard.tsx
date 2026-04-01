"use client";

interface StatCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  trend?: { value: number; direction: "up" | "down" | "flat" };
  icon?: React.ReactNode;
  sparklineData?: number[];
}

function MiniSparkline({ data }: { data: number[] }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 64;
  const h = 24;
  const pad = 2;

  const first = data[0];
  const last = data[data.length - 1];
  const color = last > first ? "#16A34A" : last < first ? "#DC2626" : "#94a3b8";

  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - pad - ((v - min) / range) * (h - pad * 2);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg width={w} height={h} className="flex-shrink-0">
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function StatCard({ label, value, subtitle, trend, icon, sparklineData }: StatCardProps) {
  const trendColor = trend?.direction === "up" ? "text-success" : trend?.direction === "down" ? "text-error" : "text-slate-400";
  const trendArrow = trend?.direction === "up" ? "↑" : trend?.direction === "down" ? "↓" : "→";

  return (
    <div className="bg-card rounded-xl border border-slate-200/80 shadow-sm p-5">
      <div className="flex items-start justify-between mb-1">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        {icon && <div className="text-slate-400">{icon}</div>}
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
      <div className="flex items-center gap-2 mt-2">
        {sparklineData && <MiniSparkline data={sparklineData} />}
        {trend && (
          <span className={`text-xs font-medium ${trendColor}`}>
            {trendArrow} {Math.abs(trend.value)}%
          </span>
        )}
      </div>
    </div>
  );
}
