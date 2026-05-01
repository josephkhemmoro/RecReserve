"use client";

import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/cn";

interface StatCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  trend?: { value: number; direction: "up" | "down" | "flat" };
  icon?: React.ReactNode;
  sparklineData?: number[];
  accent?: "default" | "brand" | "success" | "warning" | "error";
}

function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 72;
  const h = 28;
  const pad = 3;

  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - pad - ((v - min) / range) * (h - pad * 2);
      return `${x},${y}`;
    })
    .join(" ");

  // Build a filled-area version by closing the polyline back along the bottom
  const areaPath = `M0,${h} L${points.split(" ").join(" L")} L${w},${h} Z`;
  const gradientId = `spark-${color.replace("#", "")}`;

  return (
    <svg width={w} height={h} className="flex-shrink-0 overflow-visible">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.18} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradientId})`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const accents = {
  default: "",
  brand: "from-brand-surface/40 to-transparent",
  success: "from-emerald-50/60 to-transparent",
  warning: "from-amber-50/60 to-transparent",
  error: "from-red-50/60 to-transparent",
};

export function StatCard({ label, value, subtitle, trend, icon, sparklineData, accent = "default" }: StatCardProps) {
  const trendUp = trend?.direction === "up";
  const trendDown = trend?.direction === "down";
  const trendColor = trendUp ? "text-emerald-600 bg-emerald-50" : trendDown ? "text-red-600 bg-red-50" : "text-slate-500 bg-slate-50";
  const TrendIcon = trendUp ? TrendingUp : trendDown ? TrendingDown : Minus;

  const sparkColor = trendUp ? "#10b981" : trendDown ? "#ef4444" : "#0D9488";

  return (
    <div
      className={cn(
        "card-hover relative bg-card rounded-xl border border-slate-200/70 p-5 overflow-hidden",
        "shadow-[0_1px_2px_-1px_rgba(15,23,42,0.06),0_1px_3px_rgba(15,23,42,0.06)]"
      )}
    >
      {accent !== "default" && (
        <div className={cn("absolute inset-0 bg-gradient-to-br pointer-events-none", accents[accent])} />
      )}
      <div className="relative">
        <div className="flex items-start justify-between mb-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
          {icon && (
            <div className="h-8 w-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 [&>svg]:h-4 [&>svg]:w-4">
              {icon}
            </div>
          )}
        </div>
        <p className="text-2xl font-bold text-slate-900 tracking-tight tabular-nums">{value}</p>
        <div className="flex items-center justify-between mt-2 min-h-[20px]">
          <div className="flex items-center gap-2">
            {trend && (
              <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-semibold tabular-nums", trendColor)}>
                <TrendIcon className="h-3 w-3" />
                {Math.abs(trend.value)}%
              </span>
            )}
            {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
          </div>
          {sparklineData && <MiniSparkline data={sparklineData} color={sparkColor} />}
        </div>
      </div>
    </div>
  );
}
