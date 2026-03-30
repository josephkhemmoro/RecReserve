"use client";

interface SparklineProps {
  data: number[];
  color?: string;
  positiveColor?: string;
  negativeColor?: string;
  width?: number;
  height?: number;
}

function getTrendInfo(data: number[]): { direction: "up" | "down" | "flat"; percent: number } {
  if (data.length < 2) return { direction: "flat", percent: 0 };
  const first = data[0];
  const last = data[data.length - 1];
  if (first === 0 && last === 0) return { direction: "flat", percent: 0 };
  if (first === 0) return { direction: "up", percent: 100 };
  const pct = Math.round(((last - first) / first) * 100);
  if (pct > 0) return { direction: "up", percent: pct };
  if (pct < 0) return { direction: "down", percent: Math.abs(pct) };
  return { direction: "flat", percent: 0 };
}

export function Sparkline({
  data,
  color = "#3B82F6",
  positiveColor = "#22C55E",
  negativeColor = "#EF4444",
  width = 80,
  height = 28,
}: SparklineProps) {
  const trend = getTrendInfo(data);
  const lineColor =
    trend.direction === "up"
      ? positiveColor
      : trend.direction === "down"
      ? negativeColor
      : color;

  const allZero = data.every((v) => v === 0);
  const min = allZero ? 0 : Math.min(...data);
  const max = allZero ? 1 : Math.max(...data);
  const range = max - min || 1;
  const padding = 2;

  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - padding - ((v - min) / range) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(" ");

  const trendArrow = trend.direction === "up" ? "↑" : trend.direction === "down" ? "↓" : "→";
  const trendColor =
    trend.direction === "up"
      ? "text-green-600"
      : trend.direction === "down"
      ? "text-red-600"
      : "text-slate-400";

  return (
    <div className="flex items-center gap-2 mt-2">
      <svg width={width} height={height} className="flex-shrink-0">
        <polyline
          points={points}
          fill="none"
          stroke={allZero ? "#94a3b8" : lineColor}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className={`text-xs font-medium ${trendColor}`}>
        {trendArrow} {trend.percent}%
      </span>
    </div>
  );
}
