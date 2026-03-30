"use client";

import { useState } from "react";
import type { CourtOccupancy } from "@/lib/dashboardData";

interface Props {
  courts: CourtOccupancy[];
  occupancyPercent: number;
  isLoading: boolean;
}

function timeToMins(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export function CourtOccupancyHeatMap({ courts, occupancyPercent, isLoading }: Props) {
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    content: string;
  } | null>(null);

  const today = new Date();
  const nowMins = today.getHours() * 60 + today.getMinutes();
  const dateLabel = today.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6 animate-pulse">
        <div className="h-5 w-48 bg-slate-200 rounded mb-4" />
        <div className="h-40 bg-slate-100 rounded" />
      </div>
    );
  }

  if (courts.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6 text-center text-slate-500">
        No active courts to display
      </div>
    );
  }

  // Calculate hour range across all courts
  let minHour = 24;
  let maxHour = 0;
  for (const c of courts) {
    const open = timeToMins(c.openTime);
    const close = timeToMins(c.closeTime);
    minHour = Math.min(minHour, Math.floor(open / 60));
    maxHour = Math.max(maxHour, Math.ceil(close / 60));
  }

  const hours: number[] = [];
  for (let h = minHour; h < maxHour; h++) hours.push(h);

  const formatHour = (h: number) => {
    if (h === 0) return "12AM";
    if (h < 12) return `${h}AM`;
    if (h === 12) return "12PM";
    return `${h - 12}PM`;
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6 relative">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Court Occupancy</h2>
          <p className="text-sm text-slate-500">{dateLabel}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-slate-900">{occupancyPercent}%</p>
          <p className="text-xs text-slate-500">occupied today</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[600px]">
          {/* Hour labels */}
          <div className="flex ml-28">
            {hours.map((h) => (
              <div
                key={h}
                className={`flex-1 text-center text-xs font-medium pb-2 ${
                  Math.floor(nowMins / 60) === h ? "text-blue-600 font-bold" : "text-slate-400"
                }`}
              >
                {formatHour(h)}
              </div>
            ))}
          </div>

          {/* Court rows */}
          {courts.map((court) => {
            const openMins = timeToMins(court.openTime);
            const closeMins = timeToMins(court.closeTime);

            return (
              <div key={court.courtId} className="flex items-center mb-1">
                <div className="w-28 text-sm font-medium text-slate-700 truncate pr-2">
                  {court.courtName}
                </div>
                <div className="flex flex-1">
                  {hours.map((h) => {
                    const hourStart = h * 60;
                    const hourEnd = (h + 1) * 60;
                    const isOpen = hourStart >= openMins && hourEnd <= closeMins;
                    const isCurrent = Math.floor(nowMins / 60) === h;

                    // Check if booked
                    const booking = court.bookings.find(
                      (b) => b.startMins < hourEnd && b.endMins > hourStart
                    );

                    let cellClass = "bg-slate-100"; // closed
                    if (isOpen && booking) {
                      cellClass = "bg-red-500/80";
                    } else if (isOpen) {
                      cellClass = "bg-green-500/30";
                    }

                    return (
                      <div
                        key={h}
                        className={`flex-1 h-10 rounded mx-px ${cellClass} ${
                          isCurrent ? "ring-2 ring-blue-400" : ""
                        } ${booking ? "cursor-pointer" : ""}`}
                        onMouseEnter={(e) => {
                          if (booking) {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setTooltip({
                              x: rect.left + rect.width / 2,
                              y: rect.top,
                              content: `${booking.playerName}\n${booking.time}\n${
                                booking.amount > 0 ? `$${booking.amount.toFixed(2)}` : "Free"
                              }`,
                            });
                          }
                        }}
                        onMouseLeave={() => setTooltip(null)}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-4 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-green-500/30" /> Available
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-red-500/80" /> Booked
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-slate-100" /> Closed
        </span>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 bg-slate-900 text-white text-xs rounded-lg px-3 py-2 pointer-events-none whitespace-pre-line shadow-lg"
          style={{
            left: tooltip.x,
            top: tooltip.y - 8,
            transform: "translate(-50%, -100%)",
          }}
        >
          {tooltip.content}
        </div>
      )}
    </div>
  );
}
