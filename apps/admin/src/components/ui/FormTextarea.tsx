"use client";

import { cn } from "@/lib/cn";

interface FormTextareaProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  maxLength?: number;
  error?: string;
  className?: string;
}

export function FormTextarea({ label, value, onChange, placeholder, rows = 4, maxLength, error, className }: FormTextareaProps) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(maxLength ? e.target.value.slice(0, maxLength) : e.target.value)}
        placeholder={placeholder}
        rows={rows}
        maxLength={maxLength}
        className={cn(
          "w-full px-3.5 py-2.5 rounded-lg border text-sm text-slate-900 transition-colors resize-none",
          "focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand",
          error ? "border-error" : "border-slate-300"
        )}
      />
      <div className="flex justify-between mt-1.5">
        {error ? <p className="text-xs text-error">{error}</p> : <span />}
        {maxLength && (
          <p className={cn("text-xs", value.length > maxLength * 0.9 ? "text-warning" : "text-slate-400")}>
            {value.length}/{maxLength}
          </p>
        )}
      </div>
    </div>
  );
}
