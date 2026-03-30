"use client";

import type { CourtRevenue } from "@/lib/dashboardData";

interface Props {
  data: CourtRevenue[];
  isLoading: boolean;
}

export function RevenueByCourtChart({ data, isLoading }: Props) {
  const now = new Date();
  const monthName = now.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6 animate-pulse">
        <div className="h-5 w-48 bg-slate-200 rounded mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-8 bg-slate-100 rounded" />
          ))}
        </div>
      </div>
    );
  }

  const totalRevenue = data.reduce((sum, c) => sum + c.totalRevenue, 0);
  const maxRevenue = data.length > 0 ? Math.max(...data.map((c) => c.totalRevenue)) : 0;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Revenue by Court</h2>
          <p className="text-sm text-slate-500">{monthName}</p>
        </div>
      </div>

      {data.length === 0 || totalRevenue === 0 ? (
        <div className="py-8 text-center text-slate-500 text-sm">
          No revenue data for this month yet. Revenue tracking begins when players complete paid bookings.
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {data.map((court) => {
              const widthPercent =
                maxRevenue > 0 ? (court.totalRevenue / maxRevenue) * 100 : 0;

              return (
                <div key={court.courtId}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-slate-700 truncate max-w-[200px]">
                      {court.courtName}
                    </span>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="font-semibold text-slate-900">
                        ${court.totalRevenue.toFixed(2)}
                      </span>
                      <span className="text-slate-400 text-xs">
                        ({court.bookingCount} booking{court.bookingCount !== 1 ? "s" : ""})
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-6">
                    <div
                      className="bg-blue-500 h-6 rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(widthPercent, 2)}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Avg ${court.averagePerBooking.toFixed(2)}/booking
                  </p>
                </div>
              );
            })}
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center">
            <span className="text-sm font-medium text-slate-500">Total Revenue</span>
            <span className="text-lg font-bold text-slate-900">
              ${totalRevenue.toFixed(2)}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
