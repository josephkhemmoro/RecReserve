"use client";

import { cn } from "@/lib/cn";

interface FormSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
  error?: string;
  className?: string;
}

export function FormSelect({ label, value, onChange, options, disabled, error, className }: FormSelectProps) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={cn(
          "w-full px-3.5 py-2.5 rounded-lg border text-sm text-slate-900 transition-colors",
          "focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand",
          error ? "border-error" : "border-slate-300",
          disabled && "bg-slate-100 text-slate-400 cursor-not-allowed"
        )}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      {error && <p className="text-xs text-error mt-1.5">{error}</p>}
    </div>
  );
}
